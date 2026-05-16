import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ClaimStatus,
  ExchangeDirection,
  ExchangeMethod,
  ExchangeStatus,
  InvoiceItemType,
  Prisma,
  DeliveryZone as PrismaDeliveryZone,
} from '../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { UserSession } from '../auth/auth.types';
import { CustomRepresentationQueryDto } from '../common/query-builder';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import {
  ScheduleOutboundExchangeDto,
  UpdateOutboundExchangeDto,
} from './document-exchange.dto';
import { DeliveryZone, resolveDeliveryZone } from './delivery-zone.util';
import { DocumentExchangePolicyService } from './document-exchange.policy.service';

const DELIVERY_METHODS: ExchangeMethod[] = [
  ExchangeMethod.COURIER_DELIVERY,
  ExchangeMethod.INHOUSE_DELIVERY,
];

const ZONE_LABELS: Record<DeliveryZone, string> = {
  [DeliveryZone.LOCAL]: 'Local',
  [DeliveryZone.COUNTY]: 'County',
  [DeliveryZone.NATIONAL]: 'National',
};

@Injectable()
export class DocumentExchangeOutboundService {
  private readonly logger = new Logger(DocumentExchangeOutboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly humanId: HumanIdService,
    private readonly notifications: NotificationDispatchService,
    private readonly invoiceService: InvoiceService,
    private readonly policy: DocumentExchangePolicyService,
  ) {}

  async scheduleExchange(
    dto: ScheduleOutboundExchangeDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const isDelivery = DELIVERY_METHODS.includes(dto.method);

    const claim = await this.prisma.claim.findUnique({
      where: { id: dto.claimId, status: ClaimStatus.VERIFIED },
      include: {
        invoice: true,
        foundDocumentCase: { include: { currentStation: true } },
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

    // Block COURIER_DELIVERY after max failed attempts
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

    let deliveryZone: DeliveryZone | null = null;
    let stationSnapshot: Prisma.InputJsonObject | null = null;
    let addressSnapshot: Prisma.InputJsonObject | null = null;

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
        direction: ExchangeDirection.OUTBOUND,
        method: dto.method,
        status: ExchangeStatus.SCHEDULED,
        foundCaseId: claim.foundDocumentCaseId,
        claimId: dto.claimId,
        stationId: dto.stationId ?? null,
        addressId: dto.addressId ?? null,
        scheduledAt: new Date(dto.scheduledAt),
        createdById: user.id,
        // Safe cast — both enums share identical string values; Prisma requires its own type
        deliveryZone: deliveryZone as unknown as PrismaDeliveryZone,
        stationSnapshot: stationSnapshot ?? undefined,
        addressSnapshot: addressSnapshot ?? undefined,
      },
    });

    if (isDelivery && deliveryZone && claim.invoice) {
      const fee = await this.policy.getFeeForZone(deliveryZone);
      const zoneLabel = ZONE_LABELS[deliveryZone];
      const methodLabel = dto.method.replace(/_/g, ' ').toLowerCase();
      await this.invoiceService.addItem(claim.invoice.id, {
        type: InvoiceItemType.DELIVERY_FEE,
        label: `Courier Delivery Fee (${zoneLabel})`,
        description: `Zone-based flat delivery fee for ${methodLabel} to ${zoneLabel.toLowerCase()} destination`,
        amount: new Decimal(fee),
      });
    }

    const claimNumber = String(claim.claimNumber ?? '');
    const methodLabel = dto.method.replace(/_/g, ' ').toLowerCase();
    const scheduledDate = new Date(dto.scheduledAt).toDateString();

    await this.notifications.sendFromTemplate({
      templateKey: 'notification.handover.scheduled',
      data: { handover: exchange },
      userId: user.id,
      priority: NotificationPriority.NORMAL,
      eventTitle: 'Document Exchange Scheduled',
      eventBody: `Your ${methodLabel} exchange for claim #${claimNumber} is confirmed for ${scheduledDate}.`,
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
        direction: ExchangeDirection.OUTBOUND,
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

    const oldIsDelivery = DELIVERY_METHODS.includes(exchange.method);
    const newIsDelivery = DELIVERY_METHODS.includes(dto.method);

    const stationId =
      dto.method === ExchangeMethod.OWNER_PICKUP
        ? (dto.stationId ?? null)
        : null;
    const addressId =
      dto.method !== ExchangeMethod.OWNER_PICKUP
        ? (dto.addressId ?? null)
        : null;

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
          const fee = await this.policy.getFeeForZone(deliveryZone);
          const zoneLabel = ZONE_LABELS[deliveryZone];
          const methodLabel = dto.method.replace(/_/g, ' ').toLowerCase();
          await this.invoiceService.addItem(
            invoice.id,
            {
              type: InvoiceItemType.DELIVERY_FEE,
              label: `Courier Delivery Fee (${zoneLabel})`,
              description: `Zone-based flat delivery fee for ${methodLabel} to ${zoneLabel.toLowerCase()} destination`,
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
