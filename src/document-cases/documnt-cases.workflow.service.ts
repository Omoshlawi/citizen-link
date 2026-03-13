import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import {
  FoundDocumentCaseStatus,
  LostDocumentCaseStatus,
  MatchTrigger,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
} from '../common/query-builder';
import { EmbeddingService } from '../embedding/embedding.service';
import { MatchingLayeredService } from '../matching/matching.layered.service';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class DocumentCasesWorkflowService {
  private readonly logger = new Logger(DocumentCasesWorkflowService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
    private readonly embeddingService: EmbeddingService,
    private readonly matchingLayeredService: MatchingLayeredService,
  ) {}

  async submitLostCase(
    lostCaseId: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const canSubmit = await this.prismaService.lostDocumentCase.findUnique({
      where: {
        id: lostCaseId,
        status: { in: [LostDocumentCaseStatus.DRAFT] },
        case: {
          userId: user.id,
        },
      },
      include: {
        case: {
          include: {
            document: true,
          },
        },
      },
    });
    if (!canSubmit)
      throw new BadRequestException(`Can only submit your lost cases`);
    // Get reasons
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        entityType_fromStatus_toStatus_code: {
          code: 'OWNER_REPORTED_LOST_DOCUMENT',
          entityType: 'LostDocumentCase',
          fromStatus: canSubmit.status,
          toStatus: LostDocumentCaseStatus.SUBMITTED,
        },
        auto: true,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
    const lostCase = await this.prismaService.$transaction(async (tx) => {
      // Update claim status to rejected
      const lostCase = await tx.lostDocumentCase.update({
        where: { id: lostCaseId },
        data: {
          status: LostDocumentCaseStatus.SUBMITTED,
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Create transition history
      await tx.statusTransition.create({
        data: {
          entityType: 'LostDocumentCase',
          entityId: lostCaseId,
          fromStatus: canSubmit.status,
          toStatus: LostDocumentCaseStatus.SUBMITTED,
          changedById: user?.id,
          // comment: rejectDto.comment,
          reasonId: reason.id,
        },
      });
      return lostCase;
    });

    // Index document after submission in background
    if (canSubmit.case?.document) {
      this.embeddingService
        .indexDocument(canSubmit.case.document.id)
        .then(() =>
          this.matchingLayeredService.layeredMatching(
            MatchTrigger.LOST_CASE_SUBMITTED,
            canSubmit.case.document!.id,
            user,
          ),
        )
        .then((matches) => {
          this.logger.debug(
            `Found ${matches.length} matches for case ${canSubmit.case.caseNumber}`,
            matches.map((m) => m.matchNumber).join(', '),
          );
        })
        .catch((e) => {
          this.logger.error(
            'Error occured while indexing and running match algorithm',
            e,
          );
        });
    }

    return lostCase;
  }

  async submitFoundCase(
    foundCaseId: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const canSubmit = await this.prismaService.foundDocumentCase.findUnique({
      where: {
        id: foundCaseId,
        status: { in: [FoundDocumentCaseStatus.DRAFT] },
        case: {
          userId: user.id,
        },
      },
    });
    if (!canSubmit)
      throw new BadRequestException(`Can only submit your found cases`);
    // Get reasons
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        entityType_fromStatus_toStatus_code: {
          code: 'FINDER_REPORTED_FOUND_DOCUMENT',
          entityType: 'FoundDocumentCase',
          fromStatus: canSubmit.status,
          toStatus: FoundDocumentCaseStatus.SUBMITTED,
        },
        auto: true,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
    return await this.prismaService.$transaction(async (tx) => {
      // Update claim status to rejected
      const founderCase = await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: {
          status: FoundDocumentCaseStatus.SUBMITTED,
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Create transition history
      await tx.statusTransition.create({
        data: {
          entityType: 'FoundDocumentCase',
          entityId: foundCaseId,
          fromStatus: canSubmit.status,
          toStatus: FoundDocumentCaseStatus.SUBMITTED,
          changedById: user?.id,
          // comment: rejectDto.comment,
          reasonId: reason.id,
        },
      });
      return founderCase;
    });
  }

  async verifyFoundCase(
    foundCaseId: string,
    verifyDto: StatusTransitionReasonsDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const canVerify = await this.prismaService.foundDocumentCase.findUnique({
      where: {
        id: foundCaseId,
        status: { in: [FoundDocumentCaseStatus.SUBMITTED] },
      },
      include: {
        case: {
          include: {
            document: true,
          },
        },
      },
    });
    if (!canVerify)
      throw new BadRequestException(`Can only verify submitted cases`);
    // Get reasons
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        id: verifyDto.reason,
        entityType: 'FoundDocumentCase',
        fromStatus: canVerify.status,
        toStatus: FoundDocumentCaseStatus.VERIFIED,
        auto: false,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
    const foundCase = await this.prismaService.$transaction(async (tx) => {
      // Update claim status to rejected
      const founderCase = await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: {
          status: FoundDocumentCaseStatus.VERIFIED,
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Create transition history
      await tx.statusTransition.create({
        data: {
          entityType: 'FoundDocumentCase',
          entityId: foundCaseId,
          fromStatus: canVerify.status,
          toStatus: FoundDocumentCaseStatus.VERIFIED,
          changedById: user?.id,
          comment: verifyDto.comment,
          reasonId: verifyDto.reason,
        },
      });
      return founderCase;
    });
    // Index document after submission in background
    if (canVerify.case?.document?.id) {
      this.embeddingService
        .indexDocument(canVerify.case.document.id)
        .then(() =>
          this.matchingLayeredService.layeredMatching(
            MatchTrigger.FOUND_CASE_VERIFIED,
            canVerify.case.document!.id,
            user,
          ),
        )
        .then((matches) => {
          this.logger.debug(
            `Found ${matches.length} matches for case ${canVerify.case.caseNumber}`,
            matches.map((m) => m.matchNumber).join(', '),
          );
        })
        .catch((e) => {
          this.logger.error(
            'Error occured while indexing and running match algorithm',
            e,
          );
        });
    }
    return foundCase;
  }

  async rejectFoundDocumentCase(
    foundCaseId: string,
    rejectDto: StatusTransitionReasonsDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const canReject = await this.prismaService.foundDocumentCase.findUnique({
      where: {
        id: foundCaseId,
        status: { in: [FoundDocumentCaseStatus.SUBMITTED] },
      },
    });
    if (!canReject)
      throw new BadRequestException(`Can only reject submitted found cases`);
    // Get reasons
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        id: rejectDto.reason,
        entityType: 'FoundDocumentCase',
        fromStatus: canReject.status,
        toStatus: FoundDocumentCaseStatus.REJECTED,
        auto: false,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
    return await this.prismaService.$transaction(async (tx) => {
      // Update claim status to rejected
      const founderCase = await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: {
          status: FoundDocumentCaseStatus.REJECTED,
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Create transition history
      await tx.statusTransition.create({
        data: {
          entityType: 'FoundDocumentCase',
          entityId: foundCaseId,
          fromStatus: canReject.status,
          toStatus: FoundDocumentCaseStatus.REJECTED,
          changedById: user?.id,
          comment: rejectDto.comment,
          reasonId: reason.id,
        },
      });
      return founderCase;
    });
  }
}
