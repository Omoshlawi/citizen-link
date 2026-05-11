import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import dayjs from 'dayjs';
import { PrismaService } from 'src/prisma/prisma.service';
import z from 'zod';
import {
  CustodyStatus,
  ExchangeDirection,
  ExchangeStatus,
  FoundDocumentCaseStatus,
  InvoiceStatus,
  LostDocumentCaseStatus,
  Prisma,
  VerificationStatus,
} from '../../generated/prisma/client';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  RepresentationOptions,
  SortService,
} from '../common/query-builder';
import { SystemSettingService } from '../common/settings/settings.system.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import {
  CancelCodeQueryDto,
  CancelExchangeDto,
  CancelVerificationDto,
  IssueCodeQueryDto,
  QueryExchangeDto,
  VerifyCodeQueryDto,
  VerifyExchangeCodeDto,
  WithdrawScheduleQueryDto,
} from './document-exchange.dto';

@Injectable()
export class DocumentExchangeBidirectionService {
  private readonly logger = new Logger(DocumentExchangeBidirectionService.name);
  private readonly repOptions: RepresentationOptions = {
    denyPatterns: ['**.code'],
  };
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
    private readonly representation: CustomRepresentationService,
    private readonly sort: SortService,
    private readonly notifications: NotificationDispatchService,
    private readonly auth: AuthService<BetterAuthWithPlugins>,
    private readonly settings: SystemSettingService,
  ) {}

  async findAll(
    query: QueryExchangeDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const [{ success: isAdmin }, { success: isStaff }] = await Promise.all([
      this.auth.api.userHasPermission({
        body: { userId: user.id, permission: { handover: ['manage-any'] } },
      }),
      this.auth.api.userHasPermission({
        body: { userId: user.id, permission: { documentCase: ['collect'] } },
      }),
    ]);
    const canSeeAll = isAdmin || isStaff;

    const dbQuery: Prisma.DocumentExchangeWhereInput = {
      direction: query.direction,
      method: query.method,
      ...(query.status
        ? { status: query.status }
        : query.active
          ? {
              status: {
                in: [ExchangeStatus.SCHEDULED, ExchangeStatus.IN_PROGRESS],
              },
            }
          : {}),
      foundCaseId: query.foundCaseId,
      claimId: query.claimId,
      ...(canSeeAll
        ? {}
        : {
            OR: [
              {
                direction: ExchangeDirection.INBOUND,
                foundCase: { case: { userId: user.id } },
              },
              { claim: { userId: user.id } },
            ],
          }),
    };

    const totalCount = await this.prisma.documentExchange.count({
      where: dbQuery,
    });

    const data = await this.prisma.documentExchange.findMany({
      where: dbQuery,
      ...this.pagination.buildSafePaginationQuery(query, totalCount),
      ...this.representation.buildCustomRepresentationQuery(
        query?.v,
        this.repOptions,
      ),
      ...this.sort.buildSortQuery(query?.orderBy),
    });

    return {
      results: data,
      ...this.pagination.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
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
      ...this.representation.buildCustomRepresentationQuery(
        query?.v,
        this.repOptions,
      ),
    });
    if (!exchange) throw new NotFoundException('Exchange not found');
    return exchange;
  }

  private getActiveExchange(
    query: WithdrawScheduleQueryDto & { exchangeNumber?: string },
  ) {
    return this.prisma.documentExchange.findFirst({
      where: {
        direction: query.direction,
        foundCaseId:
          query.direction === ExchangeDirection.INBOUND
            ? query.foundCaseId
            : undefined,
        claimId:
          query.direction === ExchangeDirection.OUTBOUND
            ? query.claimId
            : undefined,
        exchangeNumber:
          query.direction === ExchangeDirection.OUTBOUND
            ? query.exchangeNumber
            : undefined,
        status: {
          in: [ExchangeStatus.SCHEDULED, ExchangeStatus.IN_PROGRESS],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        verifications: { orderBy: { createdAt: 'desc' } },
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
        claim: { include: { user: true, match: true, invoice: true } },
      },
    });
  }

  async withDraw(
    query: WithdrawScheduleQueryDto,
    dto: CancelExchangeDto,
    user: UserSession['user'],
  ) {
    const exchange = await this.getActiveExchange(query);
    if (!exchange) throw new NotFoundException('No active exchange not found');
    // Check owenership
    if (
      query.direction === ExchangeDirection.INBOUND &&
      exchange.foundCase.case.userId !== user.id
    ) {
      throw new ForbiddenException(
        'Only the case owner can withdraw this exchange',
      );
    }
    if (
      query.direction === ExchangeDirection.OUTBOUND &&
      exchange.claim?.userId !== user.id
    ) {
      throw new ForbiddenException('Only claimant can withdraw this exchange');
    }
    // Cancel exchange and expire verification code
    await this.prisma.documentExchange.update({
      where: { id: exchange.id },
      data: {
        status: ExchangeStatus.CANCELLED,
        cancelledById: user.id,
        cancelReason: dto.reason,
        verifications: {
          updateMany: {
            where: {
              exchangeId: exchange.id,
              status: VerificationStatus.PENDING,
            },
            data: {
              status: VerificationStatus.CANCELLED,
              cancelledById: user.id,
            },
          },
        },
      },
    });
    if (query.direction === ExchangeDirection.INBOUND) {
      const caseOwner = exchange.foundCase.case.user;
      const caseNumber = exchange.foundCase.case.caseNumber;
      const caseId = exchange.foundCase.caseId;

      this.notifications
        .sendFromTemplate({
          templateKey: 'notification.case.found.collection.cancelled',
          data: { case: { id: caseId, caseNumber } },
          userId: caseOwner.id,
          priority: NotificationPriority.NORMAL,
          eventTitle: 'Collection Cancelled',
          eventBody: `The collection for case #${caseNumber} was cancelled. Your case remains active.`,
          eventDescription: `Exchange ${exchange.id} cancelled by user ${user.id}. Reason: ${dto.reason}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send exchange cancellation notification for case ${query.foundCaseId}`,
            e,
          ),
        );
    }
    // TODO: I should decide wether to send notification or not for outbound canceleation
    return await this.findOne(exchange.id, query, user);
  }

  async issueCode(query: IssueCodeQueryDto, user: UserSession['user']) {
    const exchange = await this.getActiveExchange(query);
    if (!exchange)
      throw new NotFoundException('No active scheduled exchange found');

    if (exchange.direction === ExchangeDirection.OUTBOUND) {
      const invoice = exchange.claim?.invoice;
      if (!invoice || invoice.status !== InvoiceStatus.PAID) {
        throw new HttpException(
          'Payment must be completed before the collection code can be issued.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
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

    await this.prisma.exchangeVerification.create({
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

    if (exchange.direction === ExchangeDirection.INBOUND) {
      const caseOwner = exchange.foundCase.case.user;
      const docTypeName =
        exchange.foundCase.case.document?.type?.name ?? 'document';
      const caseNumber = exchange.foundCase.case.caseNumber;
      const caseId = exchange.foundCase.caseId;

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
          eventDescription: `Verification issued for found case ${exchange.foundCaseId} by staff ${user.id}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send verification notification for case ${exchange.foundCaseId}`,
            e,
          ),
        );
    }
    if (exchange.direction === ExchangeDirection.OUTBOUND) {
      const claimant = exchange.claim?.user;
      if (claimant) {
        const claimNumber =
          exchange.claim?.claimNumber ?? exchange.exchangeNumber;
        const claimId = exchange.claimId;
        this.notifications
          .sendFromTemplate({
            templateKey: 'notification.handover.code.issued',
            data: {
              handover: {
                exchangeNumber: exchange.exchangeNumber,
                claim: { id: claimId, claimNumber },
                collection: { code, expiresAt },
              },
            },
            userId: claimant.id,
            priority: NotificationPriority.HIGH,
            force: true,
            eventTitle: 'Your Collection Code is Ready',
            eventBody: `Show code ${code} to the CitizenLink agent to collect your document.`,
            eventDescription: `Outbound verification issued for claim ${claimId} by staff ${user.id}`,
          })
          .catch((e) =>
            this.logger.error(
              `Failed to send outbound verification notification for exchange ${exchange.id}`,
              e,
            ),
          );
      }
    }
    return await this.findOne(exchange.id, query, user);
  }

  async verifyCode(
    query: VerifyCodeQueryDto,
    dto: VerifyExchangeCodeDto,
    { user, session }: UserSession,
  ) {
    // Retrive active exchange (scheduled/in progress)
    const exchange = await this.getActiveExchange(query);
    if (!exchange)
      throw new NotFoundException('No active scheduled exchange found');
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

    const reason =
      exchange.direction === ExchangeDirection.INBOUND
        ? await this.prisma.transitionReason.findUnique({
            where: {
              entityType_fromStatus_toStatus_code: {
                code: 'STAFF_CONFIRMED_COLLECTION',
                entityType: 'FoundDocumentCase',
                fromStatus: FoundDocumentCaseStatus.DRAFT,
                toStatus: FoundDocumentCaseStatus.SUBMITTED,
              },
            },
          })
        : await this.prisma.transitionReason.findUnique({
            where: {
              entityType_fromStatus_toStatus_code: {
                code: 'STAFF_CONFIRMED_HANDOVER',
                entityType: 'FoundDocumentCase',
                fromStatus: FoundDocumentCaseStatus.VERIFIED,
                toStatus: FoundDocumentCaseStatus.COMPLETED,
              },
            },
          });

    // Pre-fetch lost case state for OUTBOUND completion (must run outside transaction)
    const lostDocumentCaseId =
      exchange.direction === ExchangeDirection.OUTBOUND
        ? (exchange.claim?.match?.lostDocumentCaseId ?? null)
        : null;
    let lostCaseCurrentStatus: LostDocumentCaseStatus | null = null;
    let lostTransitionReason: { id: string } | null = null;
    if (lostDocumentCaseId) {
      const lostCase = await this.prisma.lostDocumentCase.findUnique({
        where: { id: lostDocumentCaseId },
        select: { status: true },
      });
      lostCaseCurrentStatus = lostCase?.status ?? null;
      if (lostCaseCurrentStatus) {
        lostTransitionReason = await this.prisma.transitionReason.findUnique({
          where: {
            entityType_fromStatus_toStatus_code: {
              code: 'DOCUMENT_REUNITED_WITH_OWNER',
              entityType: 'LostDocumentCase',
              fromStatus: lostCaseCurrentStatus,
              toStatus: LostDocumentCaseStatus.COMPLETED,
            },
          },
        });
      }
    }

    const foundCaseId = exchange.foundCaseId;
    await this.prisma.$transaction(async (tx) => {
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
          status:
            exchange.direction === ExchangeDirection.INBOUND
              ? FoundDocumentCaseStatus.SUBMITTED
              : FoundDocumentCaseStatus.COMPLETED,
          custodyStatus:
            exchange.direction === ExchangeDirection.INBOUND
              ? CustodyStatus.IN_CUSTODY
              : CustodyStatus.HANDED_OVER,
          currentStationId:
            exchange.direction === ExchangeDirection.INBOUND
              ? session.stationId
              : null,
        },
      });
      await tx.statusTransition.create({
        data: {
          entityType: 'FoundDocumentCase',
          entityId: foundCaseId,
          fromStatus:
            exchange.direction === ExchangeDirection.INBOUND
              ? FoundDocumentCaseStatus.DRAFT
              : FoundDocumentCaseStatus.VERIFIED,
          toStatus:
            exchange.direction === ExchangeDirection.INBOUND
              ? FoundDocumentCaseStatus.SUBMITTED
              : FoundDocumentCaseStatus.COMPLETED,
          changedById: user.id,
          reasonId: reason?.id,
        },
      });
      // Complete the matched lost case atomically with found case completion
      if (lostDocumentCaseId && lostCaseCurrentStatus) {
        await tx.lostDocumentCase.update({
          where: { id: lostDocumentCaseId },
          data: { status: LostDocumentCaseStatus.COMPLETED },
        });
        await tx.statusTransition.create({
          data: {
            entityType: 'LostDocumentCase',
            entityId: lostDocumentCaseId,
            fromStatus: lostCaseCurrentStatus,
            toStatus: LostDocumentCaseStatus.COMPLETED,
            changedById: user.id,
            reasonId: lostTransitionReason?.id,
          },
        });
      }
    });

    if (exchange.direction === ExchangeDirection.INBOUND) {
      const caseOwner = exchange.foundCase.case.user;
      const docTypeName =
        exchange.foundCase.case.document?.type?.name ?? 'document';
      const caseNumber = exchange.foundCase.case.caseNumber;
      const caseId = exchange.foundCase.caseId;

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
          eventDescription: `Found case ${foundCaseId} exchange verified by staff ${user.id}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send exchange confirmation notification for case ${foundCaseId}`,
            e,
          ),
        );
    }
    if (exchange.direction === ExchangeDirection.OUTBOUND) {
      const claimant = exchange.claim?.user;
      if (claimant) {
        const docTypeName =
          exchange.foundCase.case.document?.type?.name ?? 'document';
        const claimNumber =
          exchange.claim?.claimNumber ?? exchange.exchangeNumber;
        const claimId = exchange.claimId;
        this.notifications
          .sendFromTemplate({
            templateKey: 'notification.handover.completed',
            data: {
              handover: {
                exchangeNumber: exchange.exchangeNumber,
                claim: { id: claimId, claimNumber },
                document: { type: { name: docTypeName } },
              },
            },
            userId: claimant.id,
            priority: NotificationPriority.HIGH,
            eventTitle: 'Document Collected Successfully',
            eventBody: `Your ${docTypeName} has been handed over. Case complete.`,
            eventDescription: `Outbound exchange ${exchange.id} completed by staff ${user.id}`,
          })
          .catch((e) =>
            this.logger.error(
              `Failed to send outbound completion notification for exchange ${exchange.id}`,
              e,
            ),
          );
      }
    }
    return await this.findOne(exchange.id, query, user);
  }

  async cancelCode(
    query: CancelCodeQueryDto,
    dto: CancelVerificationDto,
    user: UserSession['user'],
  ) {
    const exchange = await this.getActiveExchange(query);
    if (!exchange)
      throw new NotFoundException('No active scheduled exchange found');
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
    if (exchange.direction === ExchangeDirection.INBOUND) {
      const caseOwner = exchange.foundCase.case.user;
      const caseNumber = exchange.foundCase.case.caseNumber;
      const caseId = exchange.foundCase.caseId;

      this.notifications
        .sendFromTemplate({
          templateKey: 'notification.case.found.collection.cancelled',
          data: { case: { id: caseId, caseNumber } },
          userId: caseOwner.id,
          priority: NotificationPriority.NORMAL,
          eventTitle: 'Handover Session Ended',
          eventBody: `The handover session for case #${caseNumber} was ended by staff. Your exchange is still scheduled.`,
          eventDescription: `Verification ${verification.id} cancelled by staff ${user.id}. Reason: ${dto.reason}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send verification cancellation notification for case ${exchange.foundCaseId}`,
            e,
          ),
        );
    }
    if (exchange.direction === ExchangeDirection.OUTBOUND) {
      const claimant = exchange.claim?.user;
      if (claimant) {
        const claimNumber =
          exchange.claim?.claimNumber ?? exchange.exchangeNumber;
        const claimId = exchange.claimId;
        this.notifications
          .sendFromTemplate({
            templateKey: 'notification.handover.code.cancelled',
            data: {
              handover: {
                exchangeNumber: exchange.exchangeNumber,
                claim: { id: claimId, claimNumber },
              },
            },
            userId: claimant.id,
            priority: NotificationPriority.NORMAL,
            eventTitle: 'Collection Code Cancelled',
            eventBody: `Your collection code for claim #${claimNumber} was cancelled. Your appointment remains scheduled.`,
            eventDescription: `Outbound verification ${verification.id} cancelled by staff ${user.id}. Reason: ${dto.reason}`,
          })
          .catch((e) =>
            this.logger.error(
              `Failed to send outbound code-cancelled notification for exchange ${exchange.id}`,
              e,
            ),
          );
      }
    }
    return await this.findOne(exchange.id, query, user);
  }
}
