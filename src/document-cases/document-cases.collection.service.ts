import {
  BadRequestException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import z from 'zod';
import {
  CustodyStatus,
  DocumentCollectionStatus,
  ExtractionStatus,
  FoundDocumentCaseStatus,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import { SystemSettingService } from '../common/settings/settings.system.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CancelCollectionDto,
  ConfirmCollectionDto,
  InitiateCollectionResponseDto,
} from './document-cases.dto';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { NotificationPriority } from '../notifications/notification.interfaces';

@Injectable()
export class DocumentCasesCollectionService {
  private readonly logger = new Logger(DocumentCasesCollectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SystemSettingService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  private async canCollect(foundCaseId: string) {
    // Load found case + owner info
    const foundCase = await this.prisma.foundDocumentCase.findUnique({
      where: { id: foundCaseId },
      include: {
        case: {
          include: {
            document: { include: { type: true } },
            user: true,
            extraction: true,
          },
        },
      },
    });
    if (!foundCase) throw new NotFoundException('Found case not found');
    if (foundCase.status !== FoundDocumentCaseStatus.DRAFT) {
      throw new BadRequestException(
        'Collection can only be initiated on a DRAFT case',
      );
    }
    if (
      foundCase.case.extraction?.extractionStatus !== ExtractionStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Extraction must be completed before initiating collection',
      );
    }
    return foundCase;
  }

  async initiateCollection(
    foundCaseId: string,
    user: UserSession['user'],
  ): Promise<InitiateCollectionResponseDto> {
    const foundCase = await this.canCollect(foundCaseId);
    // Read configurable settings
    const ttlMinutes = await this.settings.get(
      'collection.code_ttl_minutes',
      z.coerce.number(),
      60,
    );
    const maxAttempts = await this.settings.get(
      'collection.max_attempts',
      z.coerce.number(),
      3,
    );

    // Void any existing PENDING collection for this case
    await this.prisma.documentCollection.updateMany({
      where: { foundCaseId, status: DocumentCollectionStatus.PENDING },
      data: { status: DocumentCollectionStatus.EXPIRED },
    });

    // Generate 6-digit numeric code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = dayjs().add(ttlMinutes, 'minute').toDate();

    const collection = await this.prisma.documentCollection.create({
      data: {
        foundCaseId,
        code,
        expiresAt,
        maxAttempts,
        initiatedById: user.id,
      },
    });

    const caseOwner = foundCase.case.user;
    const docTypeName = foundCase.case.document?.type?.name ?? 'document';
    const caseNumber = foundCase.case.caseNumber;
    const caseId = foundCase.case.id;

    // Dispatch code notification to finder (email + push, HIGH, force)
    this.notifications
      .sendFromTemplate({
        templateKey: 'notification.case.found.collection.initiated',
        data: {
          case: {
            id: caseId,
            caseNumber,
            document: { type: { name: docTypeName } },
          },
          collection: { code, expiresAt },
        },
        userId: caseOwner.id,
        priority: NotificationPriority.HIGH,
        force: true,
        eventTitle: 'Handover Code Ready',
        eventBody: `Share code ${code} with the CitizenLink staff member serving you. Expires soon.`,
        eventDescription: `Collection initiated for found case ${foundCaseId} by staff ${user.id}`,
      })
      .then(() =>
        this.logger.debug(
          `Collection initiation notification sent for case ${foundCaseId}`,
        ),
      )
      .catch((e) =>
        this.logger.error(
          `Failed to send collection initiation notification for case ${foundCaseId}`,
          e,
        ),
      );

    return { collectionId: collection.id, expiresAt };
  }

  async confirmCollection(
    foundCaseId: string,
    dto: ConfirmCollectionDto,
    { user, session }: UserSession,
  ) {
    const collection = await this.getActiveCollection(foundCaseId);
    if (!collection)
      throw new NotFoundException('No active collection found for this case');

    // Check expiry
    if (dayjs().isAfter(collection.expiresAt)) {
      await this.prisma.documentCollection.update({
        where: { id: collection.id },
        data: { status: DocumentCollectionStatus.EXPIRED },
      });
      throw new GoneException(
        'Collection code has expired. Please re-initiate collection.',
      );
    }

    // Check attempts exhausted
    if (collection.attempts >= collection.maxAttempts) {
      await this.prisma.documentCollection.update({
        where: { id: collection.id },
        data: { status: DocumentCollectionStatus.EXPIRED },
      });
      throw new HttpException(
        'Maximum code attempts reached. Please re-initiate collection.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Code mismatch
    if (collection.code !== dto.code) {
      const newAttempts = collection.attempts + 1;
      const remaining = collection.maxAttempts - newAttempts;
      await this.prisma.documentCollection.update({
        where: { id: collection.id },
        data: { attempts: newAttempts },
      });
      throw new BadRequestException(
        `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    // Get auto transition reason
    const reason = await this.prisma.transitionReason.findUnique({
      where: {
        entityType_fromStatus_toStatus_code: {
          code: 'STAFF_CONFIRMED_COLLECTION',
          entityType: 'FoundDocumentCase',
          fromStatus: FoundDocumentCaseStatus.DRAFT,
          toStatus: FoundDocumentCaseStatus.SUBMITTED,
        },
      },
    });

    // Atomic transition
    const updatedCase = await this.prisma.$transaction(async (tx) => {
      await tx.documentCollection.update({
        where: { id: collection.id },
        data: {
          status: DocumentCollectionStatus.CONFIRMED,
          confirmedById: user.id,
          attempts: collection.attempts + 1,
        },
      });
      await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: {
          status: FoundDocumentCaseStatus.SUBMITTED,
          custodyStatus: CustodyStatus.IN_CUSTODY,
          currentStationId: session.stationId,
        },
      });
      await tx.statusTransition.create({
        data: {
          entityType: 'FoundDocumentCase',
          entityId: foundCaseId,
          fromStatus: FoundDocumentCaseStatus.DRAFT,
          toStatus: FoundDocumentCaseStatus.SUBMITTED,
          changedById: user.id,
          reasonId: reason?.id,
        },
      });
      return tx.documentCase.findUnique({
        where: { id: collection.foundCase.caseId },
        include: {
          foundDocumentCase: true,
          lostDocumentCase: true,
          document: { include: { type: true, images: true } },
          address: true,
          extraction: true,
        },
      });
    });

    const caseOwner = collection.foundCase.case.user;
    const docTypeName =
      collection.foundCase.case.document?.type?.name ?? 'document';
    const caseNumber = collection.foundCase.case.caseNumber;
    const caseId = collection.foundCase.caseId;

    // Notify finder: document received
    this.notifications
      .sendFromTemplate({
        templateKey: 'notification.case.found.submitted',
        data: {
          case: {
            id: caseId,
            caseNumber,
            document: { type: { name: docTypeName } },
          },
        },
        userId: caseOwner.id,
        priority: NotificationPriority.HIGH,
        eventTitle: 'Document Received',
        eventBody: `Your found ${docTypeName} (case #${caseNumber}) is now in Citizen Link's care. Thank you!`,
        eventDescription: `Found case ${foundCaseId} confirmed via code by staff ${user.id}`,
      })
      .then(() =>
        this.logger.debug(
          `Submission confirmation sent for found case ${foundCaseId}`,
        ),
      )
      .catch((e) =>
        this.logger.error(
          `Failed to send submission confirmation for found case ${foundCaseId}`,
          e,
        ),
      );

    return updatedCase;
  }

  async cancelActiveCollection(
    foundCaseId: string,
    dto: CancelCollectionDto,
    user: UserSession['user'],
  ) {
    const activeCollection = await this.getActiveCollection(foundCaseId);
    if (!activeCollection)
      throw new NotFoundException('no active collection for this case');

    if (!activeCollection)
      throw new NotFoundException('No active collection found for this case');

    await this.prisma.documentCollection.update({
      where: { id: activeCollection.id },
      data: {
        status: DocumentCollectionStatus.CANCELLED,
        cancelledById: user.id,
        cancelReason: dto.reason,
      },
    });

    const caseOwner = activeCollection.foundCase.case.user;
    const caseNumber = activeCollection.foundCase.case.caseNumber;
    const caseId = activeCollection.foundCase.caseId;

    // Notify finder: collection cancelled
    this.notifications
      .sendFromTemplate({
        templateKey: 'notification.case.found.collection.cancelled',
        data: { case: { id: caseId, caseNumber } },
        userId: caseOwner.id,
        priority: NotificationPriority.NORMAL,
        eventTitle: 'Collection Cancelled',
        eventBody: `The collection for case #${caseNumber} was cancelled. Your case remains active.`,
        eventDescription: `Collection ${activeCollection.id} cancelled by staff ${user.id}. Reason: ${dto.reason}`,
      })
      .then(() =>
        this.logger.debug(
          `Cancellation notification sent for case ${foundCaseId}`,
        ),
      )
      .catch((e) =>
        this.logger.error(
          `Failed to send cancellation notification for case ${foundCaseId}`,
          e,
        ),
      );
    return {
      details: 'Canceleed succesfully',
    };
  }

  /** Returns the active (PENDING) collection for a found case, if any. */
  private getActiveCollection(foundCaseId: string) {
    return this.prisma.documentCollection.findFirst({
      where: { foundCaseId, status: DocumentCollectionStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      include: {
        foundCase: {
          include: {
            case: {
              include: {
                document: { include: { type: true } },
                user: true,
              },
            },
          },
        },
      },
    });
  }

  async caseHasActiveCollection(
    foundCaseId: string,
    user: UserSession['user'],
  ) {
    const activeCollection = await this.getActiveCollection(foundCaseId);
    if (!activeCollection) {
      return { hasActiveCollection: false };
    }
    const isOwner = activeCollection.foundCase.case.userId === user.id;
    return {
      hasActiveCollection: true,
      expiresAt: activeCollection.expiresAt,
      attempts: activeCollection.attempts,
      maxAttempts: activeCollection.maxAttempts,
      code: isOwner ? activeCollection.code : undefined,
    };
  }
}
