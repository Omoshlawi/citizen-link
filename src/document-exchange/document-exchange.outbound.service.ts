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
  ClaimStatus,
  CustodyStatus,
  ExchangeStatus,
  FoundDocumentCaseStatus,
  Prisma,
  VerificationStatus,
} from '../../generated/prisma/client';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseDate } from '../app.utils';
import {
  CancelVerificationDto,
  ConfirmOutboundCodeDto,
  IssueVerificationResponseDto,
  QueryExchangeDto,
  ScheduleOutboundExchangeDto,
} from './document-exchange.dto';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import { SystemSettingService } from '../common/settings/settings.system.service';

@Injectable()
export class DocumentExchangeOutboundService {
  private readonly logger = new Logger(DocumentExchangeOutboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly humanId: HumanIdService,
    private readonly pagination: PaginationService,
    private readonly representation: CustomRepresentationService,
    private readonly sort: SortService,
    private readonly notifications: NotificationDispatchService,
    private readonly auth: AuthService<BetterAuthWithPlugins>,
    private readonly settings: SystemSettingService,
  ) {}

  async scheduleExchange(
    dto: ScheduleOutboundExchangeDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: dto.claimId },
      include: {
        match: { select: { foundDocumentCaseId: true } },
      },
    });

    if (!claim) throw new NotFoundException('Claim not found');

    if (claim.userId !== user.id) {
      throw new BadRequestException(
        'Only the claimant can schedule an exchange',
      );
    }

    if (claim.status !== ClaimStatus.VERIFIED) {
      throw new BadRequestException(
        'Exchange can only be scheduled after the claim has been verified',
      );
    }

    const activeExchange = await this.prisma.documentExchange.findFirst({
      where: {
        claimId: dto.claimId,
        status: { in: [ExchangeStatus.SCHEDULED, ExchangeStatus.IN_PROGRESS] },
      },
    });
    if (activeExchange) {
      throw new BadRequestException(
        'An active exchange already exists for this claim',
      );
    }

    const exchange = await this.prisma.documentExchange.create({
      data: {
        exchangeNumber: await this.humanId.generate({
          prefix: EntityPrefix.EXCHANGE,
        }),
        direction: 'OUTBOUND',
        method: dto.method,
        status: ExchangeStatus.SCHEDULED,
        foundCaseId: claim.match.foundDocumentCaseId,
        claimId: dto.claimId,
        stationId: dto.stationId ?? null,
        addressId: dto.addressId ?? null,
        scheduledAt: new Date(dto.scheduledAt),
        createdById: user.id,
      },
      include: {
        claim: { select: { claimNumber: true } },
        station: { select: { name: true } },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const claimNumber = String((exchange as any).claim?.claimNumber ?? '');
    const method = String(exchange.method).toLowerCase().replace('_', ' ');
    const scheduledDate = exchange.scheduledAt.toDateString();

    await this.notifications.sendFromTemplate({
      templateKey: 'notification.handover.scheduled',
      data: { handover: exchange },
      userId: user.id,
      priority: NotificationPriority.NORMAL,
      eventTitle: 'Document Exchange Scheduled',
      eventBody: `Your ${method} exchange for claim #${claimNumber} is confirmed for ${scheduledDate}.`,
      eventDescription: `Outbound exchange ${exchange.exchangeNumber} scheduled for claim ${exchange.claimId}`,
    });

    return exchange;
  }

  async issueVerification(
    exchangeId: string,
    { user }: UserSession,
  ): Promise<IssueVerificationResponseDto> {
    const exchange = await this.prisma.documentExchange.findUnique({
      where: { id: exchangeId, direction: 'OUTBOUND' },
      include: {
        verifications: { orderBy: { createdAt: 'desc' } },
        claim: { include: { user: true } },
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
    if (!exchange) throw new NotFoundException('Exchange not found');
    if (
      exchange.status !== ExchangeStatus.SCHEDULED &&
      exchange.status !== ExchangeStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        'Verification can only be issued for a SCHEDULED or IN_PROGRESS exchange',
      );
    }

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

    await this.prisma.exchangeVerification.updateMany({
      where: { exchangeId: exchange.id, status: VerificationStatus.PENDING },
      data: { status: VerificationStatus.EXPIRED },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = dayjs().add(ttlMinutes, 'minute').toDate();

    const verification = await this.prisma.exchangeVerification.create({
      data: {
        exchangeId: exchange.id,
        code,
        expiresAt,
        maxAttempts,
        issuedById: user.id,
      },
    });

    if (exchange.status === ExchangeStatus.SCHEDULED) {
      await this.prisma.documentExchange.update({
        where: { id: exchange.id },
        data: { status: ExchangeStatus.IN_PROGRESS },
      });
    }

    const claimant = exchange.claim?.user;
    if (claimant) {
      const docTypeName =
        exchange.foundCase.case.document?.type?.name ?? 'document';
      const caseNumber = exchange.foundCase.case.caseNumber;

      this.notifications
        .sendInline({
          channels: ['PUSH', 'EMAIL'] as any,
          push: {
            title: 'Handover Code Ready',
            body: `Share code ${code} with the CitizenLink staff member. Expires soon.`,
          },
          userId: claimant.id,
          priority: NotificationPriority.HIGH,
          force: true,
          eventTitle: 'Handover Code Ready',
          eventBody: `Share code ${code} with staff for your ${docTypeName} (case #${caseNumber}). Expires soon.`,
          eventDescription: `Outbound verification issued for exchange ${exchangeId} by staff ${user.id}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send outbound verification notification for exchange ${exchangeId}`,
            e,
          ),
        );
    }

    return {
      exchangeId: exchange.id,
      exchangeNumber: exchange.exchangeNumber,
      verificationId: verification.id,
      expiresAt,
    };
  }

  async confirmVerification(
    exchangeId: string,
    dto: ConfirmOutboundCodeDto,
    { user, session }: UserSession,
  ) {
    const exchange = await this.prisma.documentExchange.findUnique({
      where: { id: exchangeId, direction: 'OUTBOUND' },
      include: {
        verifications: { orderBy: { createdAt: 'desc' } },
        claim: { include: { user: true } },
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
    if (!exchange) throw new NotFoundException('Exchange not found');
    if (exchange.status !== ExchangeStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Exchange must be IN_PROGRESS to confirm handover',
      );
    }

    const verification = exchange.verifications.find(
      (v) => v.status === VerificationStatus.PENDING,
    );
    if (!verification)
      throw new NotFoundException('No pending verification for this exchange');

    if (dayjs().isAfter(verification.expiresAt)) {
      await this.prisma.exchangeVerification.update({
        where: { id: verification.id },
        data: { status: VerificationStatus.EXPIRED },
      });
      throw new GoneException(
        'Verification code has expired. Please re-issue a code.',
      );
    }

    if (verification.attempts >= verification.maxAttempts) {
      await this.prisma.exchangeVerification.update({
        where: { id: verification.id },
        data: { status: VerificationStatus.EXPIRED },
      });
      throw new HttpException(
        'Maximum code attempts reached. Please re-issue a code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (verification.code !== dto.code) {
      const newAttempts = verification.attempts + 1;
      const remaining = verification.maxAttempts - newAttempts;
      await this.prisma.exchangeVerification.update({
        where: { id: verification.id },
        data: { attempts: newAttempts },
      });
      throw new BadRequestException(
        `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    const reason = await this.prisma.transitionReason.findUnique({
      where: {
        entityType_fromStatus_toStatus_code: {
          code: 'STAFF_CONFIRMED_HANDOVER',
          entityType: 'FoundDocumentCase',
          fromStatus: FoundDocumentCaseStatus.VERIFIED,
          toStatus: FoundDocumentCaseStatus.COMPLETED,
        },
      },
    });

    const foundCaseId = exchange.foundCaseId;

    const updatedCase = await this.prisma.$transaction(async (tx) => {
      await tx.exchangeVerification.update({
        where: { id: verification.id },
        data: {
          status: VerificationStatus.CONFIRMED,
          confirmedById: user.id,
          attempts: verification.attempts + 1,
        },
      });
      await tx.documentExchange.update({
        where: { id: exchange.id },
        data: {
          status: ExchangeStatus.COMPLETED,
          completedAt: new Date(),
          completedById: user.id,
        },
      });
      await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: {
          status: FoundDocumentCaseStatus.COMPLETED,
          custodyStatus: CustodyStatus.HANDED_OVER,
        },
      });
      await tx.statusTransition.create({
        data: {
          entityType: 'FoundDocumentCase',
          entityId: foundCaseId,
          fromStatus: FoundDocumentCaseStatus.VERIFIED,
          toStatus: FoundDocumentCaseStatus.COMPLETED,
          changedById: user.id,
          reasonId: reason?.id,
        },
      });
      return tx.documentCase.findUnique({
        where: { id: exchange.foundCase.caseId },
        include: {
          foundDocumentCase: true,
          document: { include: { type: true, images: true } },
          address: true,
        },
      });
    });

    const claimant = exchange.claim?.user;
    if (claimant) {
      const docTypeName =
        exchange.foundCase.case.document?.type?.name ?? 'document';
      const caseNumber = exchange.foundCase.case.caseNumber;

      this.notifications
        .sendInline({
          channels: ['PUSH', 'EMAIL'] as any,
          push: {
            title: 'Document Collected',
            body: `Your ${docTypeName} has been successfully handed over. Case #${caseNumber} is now complete.`,
          },
          userId: claimant.id,
          priority: NotificationPriority.HIGH,
          eventTitle: 'Document Collected',
          eventBody: `Your ${docTypeName} (case #${caseNumber}) has been successfully handed over.`,
          eventDescription: `Outbound exchange ${exchangeId} confirmed by staff ${user.id}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send handover confirmation notification for exchange ${exchangeId}`,
            e,
          ),
        );
    }

    return updatedCase;
  }

  async cancelVerification(
    exchangeId: string,
    dto: CancelVerificationDto,
    user: UserSession['user'],
  ) {
    const exchange = await this.prisma.documentExchange.findUnique({
      where: { id: exchangeId, direction: 'OUTBOUND' },
      include: {
        verifications: { orderBy: { createdAt: 'desc' } },
        claim: { include: { user: true } },
        foundCase: {
          include: {
            case: {
              include: { document: { include: { type: true } } },
            },
          },
        },
      },
    });
    if (!exchange) throw new NotFoundException('Exchange not found');
    if (exchange.status !== ExchangeStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Verification can only be cancelled on an IN_PROGRESS exchange',
      );
    }

    const verification = exchange.verifications.find(
      (v) => v.status === VerificationStatus.PENDING,
    );
    if (!verification)
      throw new NotFoundException('No pending verification to cancel');

    await this.prisma.$transaction(async (tx) => {
      await tx.exchangeVerification.update({
        where: { id: verification.id },
        data: {
          status: VerificationStatus.CANCELLED,
          cancelledById: user.id,
          cancelReason: dto.reason,
        },
      });
      await tx.documentExchange.update({
        where: { id: exchange.id },
        data: { status: ExchangeStatus.SCHEDULED },
      });
    });

    const claimant = exchange.claim?.user;
    if (claimant) {
      const docTypeName =
        exchange.foundCase.case.document?.type?.name ?? 'document';
      const caseNumber = exchange.foundCase.case.caseNumber;

      this.notifications
        .sendInline({
          channels: ['PUSH', 'EMAIL'] as any,
          push: {
            title: 'Handover Session Ended',
            body: `The handover session for your ${docTypeName} was ended by staff. Your exchange is still scheduled.`,
          },
          userId: claimant.id,
          priority: NotificationPriority.NORMAL,
          eventTitle: 'Handover Session Ended',
          eventBody: `The handover session for case #${caseNumber} was ended by staff. Your exchange is still scheduled.`,
          eventDescription: `Outbound verification ${verification.id} cancelled by staff ${user.id}. Reason: ${dto.reason}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send verification cancellation notification for exchange ${exchangeId}`,
            e,
          ),
        );
    }

    return { message: 'Verification cancelled. Exchange remains scheduled.' };
  }

  async findAll(
    query: QueryExchangeDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.auth.api.userHasPermission({
      body: { userId: user.id, permission: { handover: ['manage-any'] } },
    });

    const dbQuery: Prisma.DocumentExchangeWhereInput = {
      direction: query.direction,
      method: query.method,
      status: query.status,
      foundCaseId: query.foundCaseId,
      claimId: query.claimId,
      claim: isAdmin
        ? undefined
        : query.claimId
          ? undefined
          : { userId: user.id },
    };

    const totalCount = await this.prisma.documentExchange.count({
      where: dbQuery,
    });

    const data = await this.prisma.documentExchange.findMany({
      where: dbQuery,
      ...this.pagination.buildSafePaginationQuery(query, totalCount),
      ...this.representation.buildCustomRepresentationQuery(query?.v),
      ...this.sort.buildSortQuery(query?.orderBy),
    });

    return {
      results: data,
      ...this.pagination.buildPaginationControls(totalCount, originalUrl, query),
    };
  }

  async findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.auth.api.userHasPermission({
      body: { userId: user.id, permission: { handover: ['manage-any'] } },
    });
    const exchange = await this.prisma.documentExchange.findUnique({
      where: {
        id,
        claim: isAdmin ? undefined : { userId: user.id },
      },
      ...this.representation.buildCustomRepresentationQuery(query?.v),
    });
    if (!exchange) throw new NotFoundException('Exchange not found');
    return exchange;
  }

  async cancelOutbound(
    id: string,
    cancelDto: StatusTransitionReasonsDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const exchange = await this.prisma.documentExchange.findUnique({
      where: { id },
      include: { claim: true },
    });

    if (!exchange) throw new NotFoundException('Exchange not found');

    if (exchange.claim?.userId !== user.id) {
      throw new BadRequestException('Only the claimant can cancel an exchange');
    }

    if (exchange.status !== ExchangeStatus.SCHEDULED) {
      throw new BadRequestException(
        'Only a SCHEDULED exchange can be cancelled',
      );
    }

    const reason = await this.prisma.transitionReason.findUnique({
      where: {
        id: cancelDto.reason,
        entityType: 'Handover',
        fromStatus: 'SCHEDULED',
        toStatus: 'CANCELLED',
      },
    });
    if (!reason) throw new BadRequestException('Invalid cancellation reason');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentExchange.update({
        where: { id },
        data: {
          status: ExchangeStatus.CANCELLED,
          cancelledById: user.id,
          cancelReason: cancelDto.comment ?? reason.description,
        },
        ...this.representation.buildCustomRepresentationQuery(query?.v),
      });

      await tx.statusTransition.create({
        data: {
          entityType: 'Handover',
          entityId: id,
          fromStatus: 'SCHEDULED',
          toStatus: 'CANCELLED',
          changedById: user.id,
          comment: cancelDto.comment,
          reasonId: reason.id,
        },
      });

      return updated;
    });
  }
}
