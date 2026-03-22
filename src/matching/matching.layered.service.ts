import { Inject, Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import {
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
  FoundDocumentCase,
  LostDocumentCase,
  Match,
} from '../../generated/prisma/client';
import { MatchTrigger, MatchVerdict } from '../../generated/prisma/enums';
import { EmbeddingService } from '../embedding/embedding.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExactMatchLayer } from './layers';
import { AiVerificationLayer } from './layers/ai-verification.layer';
import { VectorSearchLayer } from './layers/vector-search.layer';
import {
  DOCUMENT_MATCHING_QUEUE,
  EXACT_FIELD_WEIGHTS,
  MATCHING_OPTIONS_TOKEN,
} from './matching.constants';
import { Layer2FildScoreDto } from './matching.dto';
import {
  DocumentMatchingJobData,
  ExactMatchResult,
  FindMatchesOptions,
  MatchingOptions,
} from './matching.interface';
import { MatchingSecurityQuestionsService } from './matching.security-questions.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MatchingLayeredService {
  private readonly logger = new Logger(MatchingLayeredService.name);
  constructor(
    private readonly exactMatchLayer: ExactMatchLayer,
    private readonly vectorSearchLayer: VectorSearchLayer,
    private readonly aiVerificationLayer: AiVerificationLayer,
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly matchingSecurityQuestionsService: MatchingSecurityQuestionsService,
    @Inject(MATCHING_OPTIONS_TOKEN)
    private readonly matchingOptions: MatchingOptions,
    private readonly humanIdService: HumanIdService,
    @InjectQueue(DOCUMENT_MATCHING_QUEUE)
    private readonly documentMatchingQueue: Queue<DocumentMatchingJobData>,
  ) {}

  async queueDocumentMatchingJob(
    trigger: MatchTrigger,
    documentId: string,
    userId: string,
  ) {
    return await this.documentMatchingQueue.add(documentId, {
      trigger,
      documentId,
      userId,
    });
  }

  private async getDocumentSearchEmbedding(documentId: string) {
    const document = await this.prismaService.document.findUnique({
      where: { id: documentId },
      include: {
        type: true,
        additionalFields: true,
        case: {
          include: {
            foundDocumentCase: true,
          },
        },
      },
    });
    if (!document) {
      this.logger.error(`Document not found ${documentId}`);
      throw new Error('Document not found');
    }
    const searchText = this.embeddingService.createDocumentText(document);
    const searchEmbedding = await lastValueFrom(
      this.embeddingService.generateEmbedding(searchText, 'search'),
    );
    return { searchEmbedding, document };
  }

  async layeredMatching(
    trigger: MatchTrigger,
    documentId: string,
    userId: string,
    options?: FindMatchesOptions,
  ) {
    this.logger.log(
      `Match triggered | caseId: ${documentId} | trigger: ${trigger}`,
    );
    // ─── Layer 1 — Vector search ──────────────────────
    const { searchEmbedding, document } =
      await this.getDocumentSearchEmbedding(documentId);
    this.logger.log(`Layer 1 starting | case: ${document.case.caseNumber}`);

    const vectorSearchCandidates = await this.vectorSearchLayer.findCandidates(
      trigger,
      documentId,
      userId,
      document.typeId,
      searchEmbedding,
      options,
    );
    if (vectorSearchCandidates.length === 0) {
      this.logger.log(
        `Layer 1 — no candidates found | case: ${document.case.caseNumber}`,
      );
      return [];
    }
    this.logger.log(
      `Layer 1 complete | ${vectorSearchCandidates.length} candidates | case: ${document.case.caseNumber}`,
    );

    // ─── Layer 2 — Exact field matching ───────────────
    this.logger.log(`Layer 2 starting | case: ${document.case.caseNumber}`);

    const exactMatchesCandidates = this.exactMatchLayer.score(
      document,
      vectorSearchCandidates,
      options,
    );
    if (exactMatchesCandidates.length === 0) {
      this.logger.log(
        `Layer 2 — no candidates survived exact threshold | case: ${document.case.caseNumber}`,
      );
      return [];
    }

    this.logger.log(
      `Layer 2 complete | ${exactMatchesCandidates.length} survivors | case: ${document.case.caseNumber}`,
    );

    return await this.persistCandidates(
      trigger,
      exactMatchesCandidates,
      userId,
      options,
    );

    /*
    // ─── Layer 3 — AI verification ────────────────────
    this.logger.log(`Layer 3 starting | case: ${document.case.caseNumber}`);

    const aiResults = await this.aiVerificationLayer.verify(
      trigger,
      exactMatchesCandidates,
      user,
      options,
    );
    if (aiResults.length === 0) {
      this.logger.log(
        `Layer 3 — no candidates survived AI verification | case: ${document.case.caseNumber}`,
      );
      return [];
    }

    this.logger.log(
      `Layer 3 complete | ${aiResults.length} survivors | case: ${document.case.caseNumber}`,
    );

    // ─── Compute final scores + persist ───────────────
    this.logger.log(
      `Final scoring & persistence | case: ${document.case.caseNumber}`,
    );

    const promises = aiResults.map(async (result) => {
      const {
        candidateDoc,
        matchedFields,
        exactScore,
        verification,
        scores,
        aiInteractionId,
        foundDocCase,
        lostDocCase,
      } = result;

      // ─── Compute final score ──────────────────────────
      const weightsAi = options?.weights?.ai ?? this.matchingOptions.weights.ai;
      const weightsExact =
        options?.weights?.exact ?? this.matchingOptions.weights.exact;
      const weightsVector =
        options?.weights?.vector ?? this.matchingOptions.weights.vector;

      const vectorScore = candidateDoc.similarity;

      const finalScore = parseFloat(
        (
          vectorScore * weightsVector +
          exactScore * weightsExact +
          scores.aiScore * weightsAi
        ).toFixed(4),
      );

      const minimumFinalScore =
        options?.minimumFinalScore ?? this.matchingOptions.minimumFinalScore;

      // Skip if below minimum final score
      if (finalScore < minimumFinalScore) {
        this.logger.debug(
          `Final score below threshold | ` +
            `finalScore: ${finalScore} < minimum: ${minimumFinalScore} | ` +
            `lostDoc: ${lostDocCase.document.fullName}`,
        );
        return null;
      }

      // ─── Build layer 2 field scores payload ──────────
      const layer2FieldScores: Layer2FildScoreDto = {
        weightedScore: exactScore,
        threshold:
          options?.exactMatchThreshold ??
          this.matchingOptions.exactMatchThreshold,
        fields: matchedFields.map((f) => ({
          ...f,
          weight: AiVerificationLayer.getFieldWeight(f.field),
          contribution: parseFloat(
            (f.score * AiVerificationLayer.getFieldWeight(f.field)).toFixed(4),
          ),
        })),
      };

      // ─── Generate security questions ──────────────────
      const {
        interactionId: securityQuestionsAiInteractionId,
        securityQuestions,
      } = await this.matchingSecurityQuestionsService.generateSecurityQuestions(
        foundDocCase,
        lostDocCase,
        user,
      );

      const lostDocumentCaseId = lostDocCase.lostDocumentCase!.id;
      const foundDocumentCaseId = foundDocCase.foundDocumentCase!.id;

      // ─── Upsert match ─────────────────────────────────
      return await this.prismaService.match.upsert({
        where: {
          lostDocumentCaseId_foundDocumentCaseId: {
            lostDocumentCaseId,
            foundDocumentCaseId,
          },
        },
        create: {
          matchNumber: await this.humanIdService.generate({
            prefix: EntityPrefix.MATCH,
          }),
          triggeredBy: trigger,
          verdict: verification.verdict,
          lostDocumentCaseId,
          foundDocumentCaseId,

          // AI interaction links
          // aiInteractionId,
          // securityQuestionsAiInteractionId,

          // Layer scores
          vectorScore,
          exactScore,
          // aiScore: scores.aiScore,
          finalScore,
          //   overallScore: scores.overallScore,

          // AI analysis
          // aiVerificationResult: verification,
          layer2FieldScores: layer2FieldScores as Record<string, any>,

          // Security questions
          // securityQuestions,
        },
        update: {
          // Rematch — update scores and analysis
          // Keep existing status unless auto-confirm threshold now met
          verdict: verification.verdict,
          triggeredBy: trigger,

          vectorScore,
          exactScore,
          // aiScore: scores.aiScore,
          finalScore,
          //   overallScore: scores.overallScore,

          // aiVerificationResult: verification,
          layer2FieldScores: layer2FieldScores as Record<string, any>,

          // securityQuestions,
          // securityQuestionsAiInteractionId,
          // aiInteractionId,
        },
      });
    });
    const finalMatches = await Promise.allSettled(promises);
    let skipped = 0;
    let withErrors = 0;
    const matches: Match[] = [];
    for (const [i, outcome] of finalMatches.entries()) {
      const candidateDoc = aiResults[i].candidateDoc;
      // Handle rejected promise
      if (outcome.status === 'rejected') {
        this.logger.error(
          `Errror persisting match for candidate doc ${candidateDoc.documentNumber ?? candidateDoc.documentId}`,
          outcome.reason,
        );
        withErrors += 1;
        continue;
      }
      if (!outcome.value) {
        this.logger.warn(
          `Matched doc ${candidateDoc.documentNumber ?? candidateDoc.documentId} not persisted for failure meet the threshold`,
        );
        skipped += 1;
        continue;
      }
      this.logger.log(
        `Successfully peristed match for document ${candidateDoc.documentNumber ?? candidateDoc.documentId}`,
      );
      matches.push(outcome.value);
    }
      
    this.logger.log(
      `Match complete | ${matches.length} succesfull matches | ${skipped} skipped matches | ${withErrors} failed due to errors | case: ${document.case.caseNumber}`,
    );

    return matches;
    */
  }

  // ---- Here downs are post ai suspension ---
  private async persistCandidates(
    trigger: MatchTrigger,
    exactResults: ExactMatchResult[],
    userId: string,
    options?: FindMatchesOptions,
  ) {
    const promises = exactResults.map(
      async ({
        exactScore,
        matchedFields,
        triggerDoc: triggerDoc_,
        candidateDoc: candidateDoc_,
      }) => {
        // Retrive document cases
        const candidateDoc = await this.getDocumentCase(
          candidateDoc_.documentId,
        );
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

        const lostDocumentCaseId = lostDocCase.lostDocumentCase!.id;
        const foundDocumentCaseId = foundDocCase.foundDocumentCase!.id;
        // ─── Build layer 2 field scores payload ──────────
        const layer2FieldScores: Layer2FildScoreDto = {
          weightedScore: exactScore,
          threshold:
            options?.exactMatchThreshold ??
            this.matchingOptions.exactMatchThreshold,
          fields: matchedFields.map((f) => ({
            ...f,
            weight: EXACT_FIELD_WEIGHTS[f.field] as number,
            maskedCandidatevalue: this.maskValue(f.candidateValue ?? ''),
            contribution: parseFloat(
              (f.score * EXACT_FIELD_WEIGHTS[f.field]).toFixed(4),
            ),
          })),
        };

        const vectorScore = candidateDoc_.similarity;
        const finalScore = exactScore;
        const verdict = this.getVerdict(finalScore);
        // ─── Upsert match ─────────────────────────────────
        return await this.prismaService.match.upsert({
          where: {
            lostDocumentCaseId_foundDocumentCaseId: {
              lostDocumentCaseId,
              foundDocumentCaseId,
            },
          },
          create: {
            matchNumber: await this.humanIdService.generate({
              prefix: EntityPrefix.MATCH,
            }),
            triggeredBy: trigger,
            verdict,
            lostDocumentCaseId,
            foundDocumentCaseId,

            // AI interaction links
            // aiInteractionId,
            // securityQuestionsAiInteractionId,

            // Layer scores
            vectorScore,
            exactScore,
            // aiScore: scores.aiScore,
            finalScore,
            //   overallScore: scores.overallScore,

            // AI analysis
            // aiVerificationResult: verification,
            layer2FieldScores: layer2FieldScores as Record<string, any>,

            // Security questions
            // securityQuestions,
          },
          update: {
            // Rematch — update scores and analysis
            // Keep existing status unless auto-confirm threshold now met
            verdict,
            triggeredBy: trigger,

            vectorScore,
            exactScore,
            // aiScore: scores.aiScore,
            finalScore,
            //   overallScore: scores.overallScore,

            // aiVerificationResult: verification,
            layer2FieldScores: layer2FieldScores as Record<string, any>,

            // securityQuestions,
            // securityQuestionsAiInteractionId,
            // aiInteractionId,
          },
        });
      },
    );
    const persistResults = await Promise.allSettled(promises);
    let failed = 0;
    const success: Match[] = [];
    for (const [i, outcome] of persistResults.entries()) {
      const candidate = exactResults[i].candidateDoc;
      // Handle failed
      if (outcome.status === 'rejected') {
        failed += 1;
        this.logger.error(
          `Failed to persist match for document ${candidate.documentNumber ?? candidate.documentId} | ${outcome.reason}`,
        );
        continue;
      }
      success.push(outcome.value);
      this.logger.log(
        `Successfully persisted match for document ${candidate.documentNumber ?? candidate.documentId}`,
      );
    }
    this.logger.log(
      `Match complete | ${success.length} succesfull matches | ${failed} failed matches`,
    );
    return success;
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

  /**
   * Derives a human-readable verdict from a weighted exact match score.
   *
   * Score bands and their practical meaning:
   *
   * | Verdict          | Score      | Typical signal                                      |
   * |------------------|------------|-----------------------------------------------------|
   * | VERIFIED_MATCH   | ≥ 0.80     | Document number + full name both strongly matched   |
   * | PROBABLE_MATCH   | ≥ 0.55     | Document number + one other field, or name + DOB    |
   * | POSSIBLE_MATCH   | ≥ 0.30     | Partial signals — surfaced for human review         |
   * | NO_MATCH         | < 0.30     | Too weak to surface, filtered out                   |
   *
   * Thresholds are calibrated for recall over precision — the expectation is
   * that a human reviewer will make the final call on a blurred document preview.
   * Prefer surfacing a false positive over missing a real match.
   *
   * @param score - Weighted exact match score in range [0, 1]
   * @returns The corresponding {@link MatchVerdict}
   */
  private getVerdict(score: number): MatchVerdict {
    if (score >= 0.8) return MatchVerdict.VERIFIED_MATCH;
    if (score >= 0.55) return MatchVerdict.PROBABLE_MATCH;
    if (score >= 0.3) return MatchVerdict.POSSIBLE_MATCH;
    return MatchVerdict.NO_MATCH;
  }
  /**
   * Masks a string value for safe display in document previews.
   *
   * Masking rules per token:
   * - Short tokens (≤ 3 chars): fully masked — too short to reveal anything safely
   * - All others: first 2 chars visible + masked middle + last char visible
   *
   * If the value contains spaces, each token is masked independently
   * and rejoined with a space — preserving the visual structure of
   * multi-word values like full names without revealing their content.
   *
   * @example
   * maskValue('ODHIAMBO')   // → 'OD*****O'
   * maskValue('AB123456')   // → 'AB*****6'
   * maskValue('JOHN DOE')   // → 'JO**N D*E'  (each token masked independently)
   * maskValue('AB')         // → '**'          (too short — fully masked)
   *
   * @param value - The raw string to mask
   * @returns The masked string, or an empty string if value is falsy
   */
  private maskValue(value: string): string {
    if (!value) return '';

    const maskToken = (token: string): string => {
      const len = token.length;

      // Too short to show start + end without revealing the full value
      if (len <= 3) return '*'.repeat(len);

      const start = token.slice(0, 2);
      const middle = '*'.repeat(len - 3); // everything between first 2 and last 1
      const end = token.slice(-1);

      return `${start}${middle}${end}`;
    };

    // If multi-word, mask each token independently to preserve visual structure
    if (value.includes(' ')) {
      return value.split(' ').map(maskToken).join(' ');
    }

    return maskToken(value);
  }
}
