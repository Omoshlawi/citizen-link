import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { ClaimStatus, ExchangeStatus } from '../../generated/prisma/client';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { SystemSettingService } from '../common/settings/settings.system.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ScheduleOutboundExchangeDto,
  UpdateOutboundExchangeDto,
} from './document-exchange.dto';

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
      where: { id: dto.claimId, status: ClaimStatus.VERIFIED },
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

  async updateExchange(
    dto: UpdateOutboundExchangeDto,
    user: UserSession['user'],
  ) {
    const exchange = await this.prisma.documentExchange.findFirst({
      where: {
        claimId: dto.claimId,
        direction: 'OUTBOUND',
        status: ExchangeStatus.SCHEDULED,
        claim: { userId: user.id },
      },
    });

    if (!exchange) {
      throw new NotFoundException(
        'No active SCHEDULED outbound exchange found for this claim',
      );
    }

    const stationId =
      dto.method === 'OWNER_PICKUP' ? (dto.stationId ?? null) : null;
    const addressId =
      dto.method !== 'OWNER_PICKUP' ? (dto.addressId ?? null) : null;

    return this.prisma.documentExchange.update({
      where: { id: exchange.id },
      data: {
        method: dto.method,
        scheduledAt: new Date(dto.scheduledAt),
        stationId,
        addressId,
      },
    });
  }
}
