import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  AIInteractionType,
  MatchVerdict,
} from '../../../generated/prisma/enums';
import { AiService } from '../../ai/ai.service';
import { UserSession } from '../../auth/auth.types';
import { PromptsService } from '../../prompts/prompts.service';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
  FoundDocumentCase,
} from '../../../generated/prisma/client';
import { MatchTrigger } from '../../../generated/prisma/enums';
import { AiMatchVerificationSchema } from '../matching.dto';
import {
  AiMatchVerification,
  AiVerificationResult,
  ComputedMatchScores,
  ExactMatchResult,
  FindMatchesOptions,
  MatchingOptions,
} from '../matching.interface';
import { MATCHING_OPTIONS_TOKEN } from '../matching.constants';
import { LostDocumentCase } from 'generated/prisma/browser';

// ─── Match value → raw score ────────────────────────
const MATCH_SCORES: Record<string, number> = {
  YES: 1.0,
  PARTIAL: 0.75, // OCR error suspected — do not penalise heavily
  NO: 0.0,
  MISSING: 0.5, // one side not provided — not a conflict
};

// ─── Verdict → score multiplier ────────────────────
const VERDICT_MULTIPLIER: Record<MatchVerdict, number> = {
  VERIFIED_MATCH: 1.0,
  PROBABLE_MATCH: 0.85,
  POSSIBLE_MATCH: 0.6,
  NO_MATCH: 0.0, // hard zero — never passes threshold
};

// ─── Field weights — critical fields carry more weight ─
const FIELD_WEIGHTS: Record<string, number> = {
  documentNumber: 0.35,
  dateOfBirth: 0.25,
  surname: 0.2,
  gender: 0.05,
  documentType: 0.05,
  default: 0.02, // any unlisted field
};

@Injectable()
export class AiVerificationLayer {
  private readonly logger = new Logger(AiVerificationLayer.name);
  private readonly MAX_TOKEN = 4096;
  private readonly TEMPERATURE = 0.2;
  private readonly TOP_T = 0.2;

  constructor(
    private readonly aiService: AiService,
    private readonly promptsService: PromptsService,
    private readonly prismaService: PrismaService,
    @Inject(MATCHING_OPTIONS_TOKEN)
    private readonly matchingOptions: MatchingOptions,
  ) {}

  async verify(
    trigger: MatchTrigger,
    exactResults: ExactMatchResult[],
    user: UserSession['user'],
    options?: FindMatchesOptions,
  ): Promise<AiVerificationResult[]> {
    const threshold =
      options?.aiMatchThreshold ?? this.matchingOptions.aiMatchThreshold;

    this.logger.debug(
      `Layer 3 — AI verification of ${exactResults.length} candidates | ` +
        `threshold: ${threshold}`,
    );

    // Run all candidates in parallel — set is already tiny (≤ topNCandidates)
    const settled = await Promise.allSettled(
      exactResults.map((result) => this.verifyOne(trigger, result, user)),
    );

    const verified: AiVerificationResult[] = [];

    for (const [index, outcome] of settled.entries()) {
      const candidateName = exactResults[index].candidateDoc.fullName;

      // ─── Handle rejected promises ─────────────────
      if (outcome.status === 'rejected') {
        this.logger.error(
          `Layer 3 — verification failed for candidate: ${candidateName}`,
          outcome.reason,
        );
        continue;
      }

      const result = outcome.value;

      // ─── Hard block — NO_MATCH never passes ───────
      if (result.verification.verdict === 'NO_MATCH') {
        this.logger.debug(
          `Layer 3 — ${candidateName} eliminated | ` +
            `verdict: NO_MATCH | ` +
            `redFlags: ${result.verification.redFlags.join(', ') || 'none'}`,
        );
        continue;
      }

      // ─── Score threshold filter ───────────────────
      if (result.scores.overallScore < threshold) {
        this.logger.debug(
          `Layer 3 — ${candidateName} eliminated | ` +
            `overallScore: ${result.scores.overallScore} < threshold: ${threshold} | ` +
            `verdict: ${result.verification.verdict}`,
        );
        continue;
      }

      this.logger.debug(
        `Layer 3 — ${candidateName} survived | ` +
          `verdict: ${result.verification.verdict} | ` +
          `overallScore: ${result.scores.overallScore} | ` +
          `confidence: ${result.scores.confidence} | ` +
          `aiScore: ${result.scores.aiScore}`,
      );

      verified.push(result);
    }

    this.logger.debug(
      `Layer 3 — ${verified.length} of ${exactResults.length} candidates survived`,
    );

    return verified;
  }

  private async getDocumentCase(documentId: string): Promise<
    DocumentCase & {
      document: Document & {
        type: DocumentType;
        additionalFields: DocumentField[];
      };
      lostDocumentCase?: LostDocumentCase | null;
      foundDocumentCase?: FoundDocumentCase | null;
    }
  > {
    const document = await this.prismaService.document.findUnique({
      where: { id: documentId },
      include: {
        type: true,
        case: {
          include: {
            lostDocumentCase: true,
            foundDocumentCase: true,
          },
        },
        additionalFields: true, // Added this to match your return type
      },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (!document.case) {
      throw new Error(`Document ${documentId} is not associated with a case.`);
    }

    // Destructure to separate 'case' and the rest of the document data
    const { case: documentCase, ...documentData } = document;

    return {
      ...documentCase,
      document: documentData,
    };
  }

  // ─── Verify a single candidate ───────────────────

  private async verifyOne(
    trigger: MatchTrigger,
    exactResult: ExactMatchResult,
    user: UserSession['user'],
  ): Promise<AiVerificationResult> {
    const {
      triggerDoc: triggerDoc_,
      candidateDoc: candidateDoc_,
      matchedFields,
      exactScore,
    } = exactResult;
    const candidateDoc = await this.getDocumentCase(candidateDoc_.documentId);
    const triggerDoc = await this.getDocumentCase(triggerDoc_.id);

    // ─── Resolve semantic lost/found from trigger direction ───
    const lostDocCase =
      trigger === MatchTrigger.LOST_CASE_SUBMITTED
        ? triggerDoc // trigger is the lost doc
        : candidateDoc; // candidate is the lost doc

    const foundDocCase =
      trigger === MatchTrigger.LOST_CASE_SUBMITTED
        ? candidateDoc // candidate is the found doc
        : triggerDoc; // trigger is the found doc

    this.logger.debug(
      `Layer 3 — verifying | ` +
        `lostDocCase: ${lostDocCase.id ?? lostDocCase.document.id} (${lostDocCase.document.fullName}) | ` +
        `foundDocCase: ${foundDocCase.id ?? foundDocCase.document.id} (${foundDocCase.document.fullName})`,
    );

    const prompt = await this.promptsService.getMatchVerificationPrompt(
      foundDocCase,
      lostDocCase,
      matchedFields,
    );

    const interaction = await this.aiService.callAIAndStoreParsed(
      prompt,
      undefined,
      {
        schema: AiMatchVerificationSchema,
        temperature: this.TEMPERATURE,
        max_completion_tokens: this.MAX_TOKEN,
        top_p: this.TOP_T,
        systemPrompt:
          'You are a document ownership verification engine. ' +
          'You reason carefully from evidence only. ' +
          'You never hallucinate field values. ' +
          'You always return valid JSON with no HTML entities and no markdown.',
      },
      AIInteractionType.DOCUMENT_MATCHING,
      'Match',
      user.id,
    );

    if (interaction.callError || interaction.parseError) {
      this.logger.error(
        `Layer 3 — failed | ` +
          `lostDoc: ${lostDocCase.document.fullName} | ` +
          `foundDoc: ${foundDocCase.document.fullName}`,
        interaction.callError || interaction.parseError,
      );
      throw new InternalServerErrorException('Failed to verify match');
    }

    const verification = interaction.parsedResponse!;
    const scores = this.computeScores(verification);

    this.logger.debug(
      `Layer 3 — verification complete | ` +
        `lostDoc: ${lostDocCase.caseNumber} | ` +
        `foundDoc: ${foundDocCase.caseNumber} | ` +
        `verdict: ${verification.verdict} | ` +
        `overallScore: ${scores.overallScore} | ` +
        `confidence: ${scores.confidence}`,
    );

    return {
      triggerDoc: triggerDoc_,
      candidateDoc: candidateDoc_,
      lostDocCase: lostDocCase, // explicit semantic reference — for MatchingService use
      foundDocCase: foundDocCase, // explicit semantic reference — for MatchingService use
      matchedFields,
      exactScore,
      verification,
      scores,
      aiInteractionId: interaction.id,
    };
  }

  // ─── Deterministic score computation ─────────────

  private computeScores(
    verification: AiMatchVerification,
  ): ComputedMatchScores {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const field of verification.fieldAnalysis) {
      // Skip fields where both sides are "Not provided" — no signal, no penalty
      if (
        field.triggerValue === 'Not provided' &&
        field.candidateValue === 'Not provided'
      )
        continue;

      const weight = AiVerificationLayer.getFieldWeight(field.field);

      // Present in found, missing in lost — slight positive signal
      // Real owner may not have filled every field in the lost report
      const score =
        field.match === 'MISSING' &&
        field.candidateValue !== 'Not provided' &&
        field.triggerValue === 'Not provided'
          ? 0.6
          : (MATCH_SCORES[field.match] ?? 0);

      weightedSum += score * weight;
      totalWeight += weight;
    }

    // No fields to score — return zero
    if (totalWeight === 0) {
      return { overallScore: 0, confidence: 'LOW', aiScore: 0 };
    }

    const rawScore = weightedSum / totalWeight;

    // Hard cap — NO_MATCH never scores above 0.20 regardless of field scores
    const overallScore =
      verification.verdict === 'NO_MATCH'
        ? Math.min(rawScore, 0.2)
        : parseFloat(rawScore.toFixed(4));

    // Confidence derived deterministically from overallScore
    const confidence: ComputedMatchScores['confidence'] =
      overallScore >= 0.85 ? 'HIGH' : overallScore >= 0.65 ? 'MEDIUM' : 'LOW';

    // aiScore — overallScore anchored by verdict multiplier
    const aiScore = parseFloat(
      (overallScore * VERDICT_MULTIPLIER[verification.verdict]).toFixed(4),
    );

    return { overallScore, confidence, aiScore };
  }
  static getFieldWeight(field: string): number {
    return FIELD_WEIGHTS[field] ?? FIELD_WEIGHTS.default;
  }
}
