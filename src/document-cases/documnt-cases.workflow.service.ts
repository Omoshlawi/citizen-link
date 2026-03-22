import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import {
  FoundDocumentCaseStatus,
  LostDocumentCaseStatus,
  MatchTrigger,
  NotificationChannel,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { Job, Queue } from 'bullmq';
import { DocumentEmbeddingJob } from './document-cases.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { DOCUMENT_EMBEDDING_QUEUE } from './document-cases.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationPriority } from 'src/notifications/notification.interfaces';
@Injectable()
export class DocumentCasesWorkflowService {
  private readonly logger = new Logger(DocumentCasesWorkflowService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
    @InjectQueue(DOCUMENT_EMBEDDING_QUEUE)
    private readonly documentEmbeddingQueue: Queue<DocumentEmbeddingJob>,
    private readonly notifications: NotificationsService,
  ) {}

  async submitLostCase(
    lostCaseId: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    //1. Validate lost case
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
    //2. Get and validate transition reasons
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
    //3. Transition status and log the transition
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

    //4. Add indexing job to queue for the document after submission in background
    if (canSubmit.case?.document) {
      this.documentEmbeddingQueue
        .add('embed-document', {
          documentId: canSubmit.case.document.id,
          trigger: MatchTrigger.LOST_CASE_SUBMITTED,
          userId: user.id,
        })
        .then((job: Job<DocumentEmbeddingJob>) => {
          this.logger.debug(
            `Added embedding job ${job.id} for document ${canSubmit.case.document!.id} to queue`,
          );
        })

        .catch((e) => {
          this.logger.error(
            `Error queuing document ${canSubmit.case.document!.id} for embedding to queue`,
            e,
          );
        });
    }
    // 5. Notify owner of successfull submission of case and inform them they'll be notified on matches
    this.notifications
      .sendFromTemplate({
        channels: [NotificationChannel.EMAIL],
        templateKey: 'notification.case.lost.repoted', // TODO: Set used template key to settings and use setting to retrive template
        data: {
          case: { ...canSubmit.case, user },
          caseType: 'Lost',
        },
        priority: NotificationPriority.HIGH,
        recipient: {
          email: user.email,
        },
        userId: user.id,
      })
      .then(() => {
        this.logger.debug(
          `Notification sent for lost case ${lostCaseId} to user ${user.id}`,
        );
      })
      .catch((e) => {
        this.logger.error(
          `Error sending notification for lost case ${lostCaseId} to user ${user.id}`,
          e,
        );
      });
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
    //1. Validate found case
    const canVerify = await this.prismaService.foundDocumentCase.findUnique({
      where: {
        id: foundCaseId,
        status: { in: [FoundDocumentCaseStatus.SUBMITTED] },
      },
      include: {
        case: {
          include: {
            document: true,
            user: true,
          },
        },
      },
    });
    if (!canVerify)
      throw new BadRequestException(`Can only verify submitted cases`);
    //2. Get and validate transition reasons
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
    //3. Transition status and log the transition
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
    //4. Add indexing job to queue for the document after submission in background
    if (canVerify.case?.document?.id) {
      this.documentEmbeddingQueue
        .add('embed-document', {
          documentId: canVerify.case.document.id,
          trigger: MatchTrigger.FOUND_CASE_VERIFIED,
          userId: user.id,
        })
        .then((job: Job<DocumentEmbeddingJob>) => {
          this.logger.debug(
            `Added embedding job ${job.id} for document ${canVerify.case.document!.id} to queue`,
          );
        })

        .catch((e) => {
          this.logger.error(
            `Error occured while adding document ${canVerify.case.document!.id} to embedding queue`,
            e,
          );
        });
    }
    //5. Notify finder of success verification of the found document
    this.notifications
      .sendFromTemplate({
        channels: [NotificationChannel.EMAIL],
        templateKey: 'notification.case.found.verified', // TODO: Set used template key to settings and use setting to retrive template
        data: {
          case: canVerify.case,
          caseType: 'Found',
        },
        priority: NotificationPriority.HIGH,
        recipient: {
          email: canVerify.case?.user?.email,
        },
        userId: canVerify.case?.user?.id,
      })
      .then(() => {
        this.logger.debug(
          `Notification sent for found case ${foundCaseId} to user ${canVerify.case?.user?.id}`,
        );
      })
      .catch((e) => {
        this.logger.error(
          `Error sending notification for found case ${foundCaseId} to user ${canVerify.case?.user?.id}`,
          e,
        );
      });
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
