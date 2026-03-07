import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  FoundDocumentCaseStatus,
  LostDocumentCaseStatus,
  MatchTrigger,
} from '../../generated/prisma/client';
import { CaseStatusTransitionsService } from '../case-status-transitions/case-status-transitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomRepresentationQueryDto } from '../common/query-builder';
import { MatchingLayeredService } from '../matching/matching.layered.service';
import { UserSession } from '../auth/auth.types';
import { EmbeddingService } from '../embedding/embedding.service';
@Injectable()
export class DocumentCasesWorkflowService {
  private readonly logger = new Logger(DocumentCasesWorkflowService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly caseStatusTransitionsService: CaseStatusTransitionsService,
    private readonly embeddingService: EmbeddingService,
    private readonly matchingLayeredService: MatchingLayeredService,
  ) {}
  async submitDocumentCase(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    // First, verify it's a found case owned by the user
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id, userId: user.id },
      include: {
        foundDocumentCase: true,
        lostDocumentCase: true,
        document: true,
      },
    });

    if (!documentCase) {
      throw new NotFoundException('Document case not found');
    }

    if (
      documentCase.foundDocumentCase?.status !==
        FoundDocumentCaseStatus.DRAFT &&
      documentCase.lostDocumentCase?.status !== LostDocumentCaseStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot submit case. Current status: ${documentCase.foundDocumentCase?.status ?? documentCase?.lostDocumentCase?.status}. Only DRAFT cases can be submitted.`,
      );
    }

    const statustransition =
      await this.caseStatusTransitionsService.transitionStatus(
        id,
        'SUBMITTED',
        ActorType.USER,
        user.id,
        query?.v,
      );

    // Index document after submission
    if (documentCase.document?.id) {
      await this.embeddingService.indexDocument(documentCase.document.id);
      // // For lost cass run match algorithm on submission
      if (documentCase.lostDocumentCase) {
        void this.matchingLayeredService
          .layeredMatching(
            MatchTrigger.LOST_CASE_SUBMITTED,
            documentCase.document.id,
            user,
          )
          .then((matches) => {
            this.logger.debug(
              `Found ${matches.length} matches for case ${documentCase.caseNumber}`,
              matches.map((m) => m.matchNumber).join(', '),
            );
          });
      }
    }

    return statustransition;
  }

  async verifyFoundDocumentCase(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    this.logger.log(`Verifying found document case ${id} for user ${user.id}`);
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id },
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
        user.id,
        query?.v,
      );

    // Index document on veriication and run match algorithm
    if (documentCase.document?.id) {
      await this.embeddingService.indexDocument(documentCase.document.id);
      void this.matchingLayeredService
        .layeredMatching(
          MatchTrigger.FOUND_CASE_VERIFIED,
          documentCase.document.id,
          user,
        )
        .then((matches) => {
          this.logger.debug(
            `Found ${matches.length} matches for document ${documentCase.caseNumber}`,
            matches.map((m) => m.matchNumber).join(', '),
          );
        });
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
