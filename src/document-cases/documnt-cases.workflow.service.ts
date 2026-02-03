import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  FoundDocumentCaseStatus,
} from '../../generated/prisma/client';
import { EmbeddingService } from '../ai/embeding.service';
import { CaseStatusTransitionsService } from '../case-status-transitions/case-status-transitions.service';
import { MatchingService } from '../matching/matching.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomRepresentationQueryDto } from '../common/query-builder';
@Injectable()
export class DocumentCasesWorkflowService {
  private readonly logger = new Logger(DocumentCasesWorkflowService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly caseStatusTransitionsService: CaseStatusTransitionsService,
    private readonly embeddingService: EmbeddingService,
    private readonly matchingService: MatchingService,
  ) {}
  async submitFoundDocumentCase(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    // First, verify it's a found case owned by the user
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id, userId },
      include: {
        foundDocumentCase: true,
      },
    });

    if (!documentCase) {
      throw new NotFoundException('Document case not found');
    }

    if (!documentCase.foundDocumentCase) {
      throw new BadRequestException('This is not a found document case');
    }

    if (
      documentCase.foundDocumentCase.status !== FoundDocumentCaseStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot submit case. Current status: ${documentCase.foundDocumentCase.status}. Only DRAFT cases can be submitted.`,
      );
    }

    return await this.caseStatusTransitionsService.transitionStatus(
      id,
      FoundDocumentCaseStatus.SUBMITTED,
      ActorType.USER,
      userId,
      query?.v,
    );
  }

  async verifyFoundDocumentCase(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    this.logger.log(`Verifying found document case ${id} for user ${userId}`);
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id, userId },
      include: {
        foundDocumentCase: true,
        document: true,
      },
    });

    if (!documentCase) {
      throw new NotFoundException('Document case not found');
    }

    if (!documentCase.foundDocumentCase) {
      throw new BadRequestException('This is not a found document case');
    }
    const statusTransition =
      await this.caseStatusTransitionsService.transitionStatus(
        id,
        FoundDocumentCaseStatus.VERIFIED,
        ActorType.USER,
        userId,
        query?.v,
      );
    if (documentCase.document?.id) {
      await this.embeddingService.indexDocument(documentCase.document.id);
      const matches =
        await this.matchingService.findMatchesForFoundDocumentAndVerify(
          documentCase.document.id,
          userId,
          {
            limit: 20,
            similarityThreshold: 0.5,
            minVerificationScore: 0.6,
          },
        );
      this.logger.debug(
        `Found ${matches.length} matches for document ${documentCase.document.id}`,
        matches,
      );
    }
    return statusTransition;
  }

  async rejectFoundDocumentCase(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    this.logger.log(`Rejecting found document case ${id} for user ${userId}`);
    return await this.caseStatusTransitionsService.transitionStatus(
      id,
      FoundDocumentCaseStatus.REJECTED,
      ActorType.USER,
      userId,
      query?.v,
    );
  }
}
