import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  ClaimStatus,
  ExchangeMethod,
  ExchangeStatus,
  InvoiceItemType,
} from '../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { EntityPrefix } from '../human-id/human-id.constants';
// SystemSettingService is @Global() — consumed via DocumentExchangePolicyService
import { HumanIdService } from '../human-id/human-id.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import {
  ScheduleOutboundExchangeDto,
  UpdateOutboundExchangeDto,
} from './document-exchange.dto';
import { resolveDeliveryZone } from './delivery-zone.util';
import { DocumentExchangePolicyService } from './document-exchange.policy.service';

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
    private readonly invoiceService: InvoiceService,
    private readonly policy: DocumentExchangePolicyService,
  ) {}

  async scheduleExchange(
    dto: ScheduleOutboundExchangeDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const isDelivery =
      dto.method === ExchangeMethod.COURIER_DELIVERY ||
      dto.method === ExchangeMethod.INHOUSE_DELIVERY;

    const claim = await this.prisma.claim.findUnique({
      where: { id: dto.claimId, status: ClaimStatus.VERIFIED },
      include: {
        invoice: true,
        foundDocumentCase: {
          include: { currentStation: true },
        },
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

    // Policy guard: block COURIER_DELIVERY after max failed attempts
    if (dto.method === ExchangeMethod.COURIER_DELIVERY) {
      const maxAttempts = await this.policy.getMaxAttempts();
      const failedCount = await this.prisma.documentExchange.count({
        where: {
          claimId: dto.claimId,
          method: ExchangeMethod.COURIER_DELIVERY,
          status: ExchangeStatus.FAILED,
        },
      });
      if (failedCount >= maxAttempts) {
        throw new BadRequestException(
          `Maximum courier delivery attempts (${maxAttempts}) reached. Please select in-person collection at a station.`,
        );
      }
    }

    // Resolve zone and capture snapshots for delivery methods
    let deliveryZone: string | null = null;
    let stationSnapshot: object | null = null;
    let addressSnapshot: object | null = null;

    if (isDelivery && dto.addressId) {
      const [address, station] = await Promise.all([
        this.prisma.address.findUniqueOrThrow({ where: { id: dto.addressId } }),
        Promise.resolve(claim.foundDocumentCase?.currentStation ?? null),
      ]);

      if (station) {
        deliveryZone = resolveDeliveryZone(
          station.level1,
          station.level2,
          address.level1,
          address.level2,
        );

        stationSnapshot = {
          id: station.id,
          code: station.code,
          name: station.name,
          address1: station.address1,
          level1: station.level1,
          level2: station.level2 ?? null,
          level3: station.level3 ?? null,
          country: station.country,
        };
      }

      addressSnapshot = {
        id: address.id,
        address1: address.address1,
        address2: address.address2 ?? null,
        level1: address.level1,
        level2: address.level2 ?? null,
        level3: address.level3 ?? null,
        level4: address.level4 ?? null,
        landmark: address.landmark ?? null,
        name: address.name ?? null,
        phoneNumber: address.phoneNumber ?? null,
        latitude: address.latitude?.toString() ?? null,
        longitude: address.longitude?.toString() ?? null,
      };
    }

    const exchange = await this.prisma.documentExchange.create({
      data: {
        exchangeNumber: await this.humanId.generate({
          prefix: EntityPrefix.EXCHANGE,
        }),
        direction: 'OUTBOUND',
        method: dto.method,
        status: ExchangeStatus.SCHEDULED,
        foundCaseId: claim.foundDocumentCaseId,
        claimId: dto.claimId,
        stationId: dto.stationId ?? null,
        addressId: dto.addressId ?? null,
        scheduledAt: new Date(dto.scheduledAt),
        createdById: user.id,
        deliveryZone: deliveryZone as any,
        stationSnapshot: stationSnapshot ?? undefined,
        addressSnapshot: addressSnapshot ?? undefined,
      },
      include: {
        claim: { select: { claimNumber: true } },
        station: { select: { name: true } },
      },
    });

    // Add delivery fee to the invoice when a delivery method is selected
    if (isDelivery && deliveryZone && claim.invoice) {
      const fee = await this.policy.getFeeForZone(deliveryZone as any);
      const zoneLabel =
        deliveryZone === 'LOCAL'
          ? 'Local'
          : deliveryZone === 'COUNTY'
            ? 'County'
            : 'National';
      await this.invoiceService.addItem(claim.invoice.id, {
        type: InvoiceItemType.DELIVERY_FEE,
        label: `Courier Delivery Fee (${zoneLabel})`,
        description: `Zone-based flat delivery fee for ${dto.method.replace('_', ' ').toLowerCase()} to ${zoneLabel.toLowerCase()} destination`,
        amount: new Decimal(fee),
      });
    }

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
    const DELIVERY_METHODS: ExchangeMethod[] = [
      ExchangeMethod.COURIER_DELIVERY,
      ExchangeMethod.INHOUSE_DELIVERY,
    ];

    const exchange = await this.prisma.documentExchange.findFirst({
      where: {
        claimId: dto.claimId,
        direction: 'OUTBOUND',
        status: ExchangeStatus.SCHEDULED,
        claim: { userId: user.id },
      },
      include: {
        claim: {
          include: {
            invoice: true,
            foundDocumentCase: { include: { currentStation: true } },
          },
        },
      },
    });

    if (!exchange) {
      throw new NotFoundException(
        'No active SCHEDULED outbound exchange found for this claim',
      );
    }

    const oldIsDelivery = DELIVERY_METHODS.includes(
      exchange.method as ExchangeMethod,
    );
    const newIsDelivery = DELIVERY_METHODS.includes(dto.method as ExchangeMethod);

    const stationId =
      dto.method === ExchangeMethod.OWNER_PICKUP ? (dto.stationId ?? null) : null;
    const addressId =
      dto.method !== ExchangeMethod.OWNER_PICKUP ? (dto.addressId ?? null) : null;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentExchange.update({
        where: { id: exchange.id },
        data: {
          method: dto.method,
          scheduledAt: new Date(dto.scheduledAt),
          stationId,
          addressId,
        },
      });

      const invoice = exchange.claim?.invoice;
      if (!invoice) return updated;

      if (oldIsDelivery) {
        await this.invoiceService.removeDeliveryFees(invoice.id, tx);
      }

      if (newIsDelivery && addressId) {
        const [address, station] = await Promise.all([
          tx.address.findUniqueOrThrow({ where: { id: addressId } }),
          Promise.resolve(
            exchange.claim?.foundDocumentCase?.currentStation ?? null,
          ),
        ]);
        if (station) {
          const deliveryZone = resolveDeliveryZone(
            station.level1,
            station.level2,
            address.level1,
            address.level2,
          );
          const fee = await this.policy.getFeeForZone(deliveryZone as any);
          const zoneLabel =
            deliveryZone === 'LOCAL'
              ? 'Local'
              : deliveryZone === 'COUNTY'
                ? 'County'
                : 'National';
          await this.invoiceService.addItem(
            invoice.id,
            {
              type: InvoiceItemType.DELIVERY_FEE,
              label: `Courier Delivery Fee (${zoneLabel})`,
              description: `Zone-based flat delivery fee for ${dto.method.replace('_', ' ').toLowerCase()} to ${zoneLabel.toLowerCase()} destination`,
              amount: new Decimal(fee),
            },
            tx,
          );
        }
      }

      return updated;
    });
  }
}
