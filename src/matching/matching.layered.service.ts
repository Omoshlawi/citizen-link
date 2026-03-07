import { Inject, Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { MatchTrigger } from '../../generated/prisma/enums';
import { UserSession } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ExactMatchLayer } from './layers';
import { AiVerificationLayer } from './layers/ai-verification.layer';
import { VectorSearchLayer } from './layers/vector-search.layer';
import { FindMatchesOptions, MatchingOptions } from './matching.interface';
import { MatchingSecurityQuestionsService } from './matching.security-questions.service';
import { MATCHING_OPTIONS_TOKEN } from './matching.constants';
import { Layer2FildScoreDto } from './matching.dto';
import { HumanIdService } from '../human-id/human-id.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { Match } from 'generated/prisma/client';
import { EmbeddingService } from '../embedding/embedding.service';

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
  ) {}

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
    user: UserSession['user'],
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
      user.id,
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
          aiInteractionId,
          securityQuestionsAiInteractionId,

          // Layer scores
          vectorScore,
          exactScore,
          aiScore: scores.aiScore,
          finalScore,
          //   overallScore: scores.overallScore,

          // AI analysis
          aiVerificationResult: verification,
          layer2FieldScores: layer2FieldScores as Record<string, any>,

          // Security questions
          securityQuestions,
        },
        update: {
          // Rematch — update scores and analysis
          // Keep existing status unless auto-confirm threshold now met
          verdict: verification.verdict,
          triggeredBy: trigger,

          vectorScore,
          exactScore,
          aiScore: scores.aiScore,
          finalScore,
          //   overallScore: scores.overallScore,

          aiVerificationResult: verification,
          layer2FieldScores: layer2FieldScores as Record<string, any>,

          securityQuestions,
          securityQuestionsAiInteractionId,
          aiInteractionId,
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
  }
}
