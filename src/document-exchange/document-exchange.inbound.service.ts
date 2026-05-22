import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ExchangeDirection,
  ExchangeMethod,
  ExchangeStatus,
  ExtractionStatus,
  FoundDocumentCaseStatus,
  VerificationStatus,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import { SystemSettingService } from '../common/settings/settings.system.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleInboundExchangeDto } from './document-exchange.dto';

@Injectable()
export class DocumentExchangeInboundService {
  private readonly logger = new Logger(DocumentExchangeInboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SystemSettingService,
    private readonly humanId: HumanIdService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  private async getFoundCaseForExchange(foundCaseId: string) {
    const foundCase = await this.prisma.foundDocumentCase.findUnique({
      where: { id: foundCaseId },
      include: {
        case: {
          include: {
            document: { include: { type: true } },
            user: true,
            extractions: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!foundCase) throw new NotFoundException('Found case not found');
    if (foundCase.status !== FoundDocumentCaseStatus.DRAFT) {
      throw new BadRequestException(
        `Exchange can only be scheduled for a ${FoundDocumentCaseStatus.DRAFT} case`,
      );
    }
    if (
      foundCase.case.extractions?.[0]?.extractionStatus !== ExtractionStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'AI processing must be completed before scheduling an exchange',
      );
    }
    return foundCase;
  }

  // ─── User (finder) actions ────────────────────────────────────────────────

  async scheduleExchange(
    dto: ScheduleInboundExchangeDto,
    { user }: UserSession,
  ) {
    const foundCase = await this.getFoundCaseForExchange(dto.foundCaseId);

    if (foundCase.case.userId !== user.id) {
      throw new ForbiddenException(
        'Only the case owner can schedule an inbound exchange',
      );
    }

    const existing = await this.getActiveInboundExchange(dto.foundCaseId);
    if (existing) {
      throw new BadRequestException(
        'An active exchange already exists for this case. Cancel it before scheduling a new one.',
      );
    }

    return await this.prisma.documentExchange.create({
      data: {
        exchangeNumber: await this.humanId.generate({
          prefix: EntityPrefix.EXCHANGE,
        }),
        direction: ExchangeDirection.INBOUND,
        method: dto.method,
        status: ExchangeStatus.SCHEDULED,
        foundCaseId: dto.foundCaseId,
        stationId:
          dto.method === ExchangeMethod.STATION_DROPOFF
            ? (dto.stationId ?? null)
            : null,
        addressId:
          dto.method === ExchangeMethod.AGENT_PICKUP
            ? (dto.addressId ?? null)
            : null,
        scheduledAt: new Date(dto.scheduledAt),
        createdById: user.id,
      },
    });
  }

  private getActiveInboundExchange(foundCaseId: string) {
    return this.prisma.documentExchange.findFirst({
      where: {
        foundCaseId,
        direction: ExchangeDirection.INBOUND,
        status: { in: [ExchangeStatus.SCHEDULED, ExchangeStatus.IN_PROGRESS] },
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
      },
    });
  }

  async getActiveExchangeState(foundCaseId: string, user: UserSession['user']) {
    const exchange = await this.getActiveInboundExchange(foundCaseId);
    if (!exchange) return { hasActiveExchange: false as const };

    const pendingVerification = exchange.verifications.find(
      (v) => v.status === VerificationStatus.PENDING,
    );
    const isOwner = exchange.foundCase.case.userId === user.id;

    return {
      hasActiveExchange: true as const,
      exchangeId: exchange.id,
      exchangeNumber: exchange.exchangeNumber,
      status: exchange.status,
      method: exchange.method,
      stationId: exchange.stationId,
      addressId: exchange.addressId,
      scheduledAt: exchange.scheduledAt,
      expiresAt: pendingVerification?.expiresAt,
      attempts: pendingVerification?.attempts,
      maxAttempts: pendingVerification?.maxAttempts,
      code: isOwner ? pendingVerification?.code : undefined,
    };
  }
}
