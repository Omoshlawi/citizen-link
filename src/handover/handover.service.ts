import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClaimStatus,
  HandoverStatus,
  Prisma,
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
import { QueryHandoverDto, ScheduleHandoverDto } from './handover.dto';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';

@Injectable()
export class HandoverService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly humanIdService: HumanIdService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly notificationService: NotificationDispatchService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}

  async scheduleHandover(
    dto: ScheduleHandoverDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const claim = await this.prismaService.claim.findUnique({
      where: { id: dto.claimId },
      include: { handover: true },
    });

    if (!claim) throw new NotFoundException('Claim not found');

    if (claim.userId !== user.id) {
      throw new BadRequestException(
        'Only the claimant can schedule a handover',
      );
    }

    if (claim.status !== ClaimStatus.VERIFIED) {
      throw new BadRequestException(
        'Handover can only be scheduled after the claim has been verified',
      );
    }

    if (claim.handover) {
      throw new BadRequestException(
        'A handover has already been scheduled for this claim',
      );
    }

    const handover = await this.prismaService.handover.create({
      data: {
        handoverNumber: await this.humanIdService.generate({
          prefix: EntityPrefix.HANDOVER,
        }),
        claimId: dto.claimId,
        method: dto.method,
        scheduledDate: new Date(dto.scheduledDate),
        pickupStationId: dto.pickupStationId ?? null,
        deliveryAddressId: dto.deliveryAddressId ?? null,
      },
      include: {
        claim: { select: { claimNumber: true } },
        pickupStation: { select: { name: true } },
      },
    });

    const method = String(handover.method).toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const claimNumber = String((handover as any).claim?.claimNumber ?? '');
    const scheduledDate = handover.scheduledDate.toDateString();

    await this.notificationService.sendFromTemplate({
      templateKey: 'notification.handover.scheduled',
      data: { handover },
      userId: user.id,
      priority: NotificationPriority.NORMAL,
      eventTitle: 'Handover Scheduled',
      eventBody: `Your ${method} handover for claim #${claimNumber} is confirmed for ${scheduledDate}.`,
      eventDescription: `Handover ${handover.handoverNumber} scheduled for claim ${handover.claimId}`,
    });

    return handover;
  }

  async findAll(
    query: QueryHandoverDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { handover: ['manage-any'] } },
    });
    const dbQuery: Prisma.HandoverWhereInput = {
      AND: [
        {
          claimId: query.claimId,
          status: query.status,
          method: query.method,
          scheduledDate: {
            gte: parseDate(query.scheduledDateFrom),
            lte: parseDate(query.scheduledDateTo),
          },
          claim: isAdmin ? undefined : { userId: user.id },
        },
      ],
    };

    const totalCount = await this.prismaService.handover.count({
      where: dbQuery,
    });

    const data = await this.prismaService.handover.findMany({
      where: dbQuery,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    });

    return {
      results: data,
      ...this.paginationService.buildPaginationControls(
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
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { handover: ['manage-any'] } },
    });
    const handover = await this.prismaService.handover.findUnique({
      where: { id, claim: isAdmin ? undefined : { userId: user.id } },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!handover) throw new NotFoundException('Handover not found');
    return handover;
  }

  async cancel(
    id: string,
    cancelDto: StatusTransitionReasonsDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const handover = await this.prismaService.handover.findUnique({
      where: { id },
      include: { claim: true },
    });

    if (!handover) throw new NotFoundException('Handover not found');

    if (handover.claim.userId !== user.id) {
      throw new BadRequestException('Only the claimant can cancel a handover');
    }

    if (handover.status !== HandoverStatus.SCHEDULED) {
      throw new BadRequestException(
        'Only a scheduled handover can be cancelled',
      );
    }

    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        id: cancelDto.reason,
        entityType: 'Handover',
        fromStatus: HandoverStatus.SCHEDULED,
        toStatus: HandoverStatus.CANCELLED,
      },
    });
    if (!reason) throw new BadRequestException('Invalid cancellation reason');

    return this.prismaService.$transaction(async (tx) => {
      const updated = await tx.handover.update({
        where: { id },
        data: { status: HandoverStatus.CANCELLED },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });

      await tx.statusTransition.create({
        data: {
          entityType: 'Handover',
          entityId: id,
          fromStatus: HandoverStatus.SCHEDULED,
          toStatus: HandoverStatus.CANCELLED,
          changedById: user.id,
          comment: cancelDto.comment,
          reasonId: reason.id,
        },
      });

      return updated;
    });
  }
}
