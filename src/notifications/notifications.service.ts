/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserSession } from '../auth/auth.types';
import { BetterAuthWithPlugins } from '../auth/auth.types';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  PaginationService,
} from '../common/query-builder';
import { CustomRepresentationService } from '../common/query-builder/representation.service';
import { SortService } from '../common/query-builder/sort.service';
import { QueryNotificationLogDto } from './notification.dto';
import {
  NotificationChannel,
  NotificationStatus,
} from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';

type EventStatus = 'SENT' | 'FAILED' | 'PENDING' | 'PARTIAL';

function deriveEventStatus(
  logs: { status: NotificationStatus }[],
): EventStatus {
  if (!logs.length) return 'PENDING';
  const statuses = logs.map((l) => l.status);
  if (statuses.every((s) => s === 'SENT')) return 'SENT';
  if (statuses.every((s) => s === 'FAILED' || s === 'SKIPPED')) return 'FAILED';
  if (statuses.some((s) => s === 'SENT')) return 'PARTIAL';
  return 'PENDING';
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}

  async findAll(
    query: QueryNotificationLogDto,
    user: UserSession['user'],
    originalUrl: string,
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { notification: ['list-any'] } },
    });
    const dbQuery: Prisma.NotificationEventWhereInput = {
      voided: query?.includeVoided ? undefined : false,
      userId: isAdmin ? (query?.userId ?? undefined) : user.id,
      createdAt: {
        gte: query?.from,
        lte: query?.to,
      },
    };

    const totalCount = await this.prisma.notificationEvent.count({
      where: dbQuery,
    });

    const events = await this.prisma.notificationEvent.findMany({
      where: dbQuery,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.sortService.buildSortQuery(query?.orderBy),
      include: {
        logs: {
          select: { status: true, channel: true, sentAt: true },
        },
      },
    });

    const results = events.map((event) => this.formatEvent(event));

    return {
      results,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  async getUnreadCount(user: UserSession['user']): Promise<{ count: number }> {
    const count = await this.prisma.notificationEvent.count({
      where: {
        userId: user.id,
        readAt: null,
        voided: false,
      },
    });
    return { count };
  }

  async findOne(id: string, user: UserSession['user']) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { notification: ['view-any'] } },
    });
    const event = await this.prisma.notificationEvent.findUnique({
      where: { id },
      include: {
        logs: {
          select: {
            id: true,
            channel: true,
            status: true,
            provider: true,
            to: true,
            sentAt: true,
            attempts: true,
            lastError: true,
          },
        },
      },
    });
    if (!event) {
      throw new NotFoundException(`Notification event ${id} not found`);
    }
    if (!isAdmin && event.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    return this.formatEvent(event);
  }

  async getEventLogs(id: string, user: UserSession['user']) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { notification: ['view-any'] } },
    });
    const event = await this.prisma.notificationEvent.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!event) {
      throw new NotFoundException(`Notification event ${id} not found`);
    }
    if (!isAdmin && event.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    return this.prisma.notificationLog.findMany({
      where: { eventId: id, voided: false },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markRead(id: string, user: UserSession['user']) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { notification: ['manage-any'] } },
    });
    const event = await this.prisma.notificationEvent.findUnique({
      where: { id },
    });
    if (!event) {
      throw new NotFoundException(`Notification event ${id} not found`);
    }
    if (!isAdmin && event.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    if (event.readAt) return this.formatEvent({ ...event, logs: [] });
    const updated = await this.prisma.notificationEvent.update({
      where: { id },
      data: { readAt: new Date() },
      include: {
        logs: { select: { status: true, channel: true, sentAt: true } },
      },
    });
    return this.formatEvent(updated);
  }

  async remove(id: string, user: UserSession['user'], query: DeleteQueryDto) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { notification: ['manage-any'] } },
    });
    const event = await this.prisma.notificationEvent.findUnique({
      where: { id },
    });
    if (!event) {
      throw new NotFoundException(`Notification event ${id} not found`);
    }
    if (!isAdmin && event.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    if (query?.purge) {
      return this.prisma.notificationEvent.delete({ where: { id } });
    }
    return this.prisma.notificationEvent.update({
      where: { id },
      data: { voided: true },
    });
  }

  async restore(
    id: string,
    user: UserSession['user'],
    _query: CustomRepresentationQueryDto,
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { notification: ['manage-any'] } },
    });
    const event = await this.prisma.notificationEvent.findUnique({
      where: { id },
    });
    if (!event) {
      throw new NotFoundException(`Notification event ${id} not found`);
    }
    if (!isAdmin) {
      throw new ForbiddenException('Access denied');
    }
    return this.prisma.notificationEvent.update({
      where: { id },
      data: { voided: false },
    });
  }

  private formatEvent(event: {
    id: string;
    title: string;
    body: string;
    description?: string | null;
    readAt: Date | null;
    voided: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    templateId: string | null;
    logs: {
      status: NotificationStatus;
      channel: NotificationChannel;
      sentAt?: Date | null;
    }[];
  }) {
    const status = deriveEventStatus(event.logs);
    const channelsSent = [
      ...new Set(
        event.logs.filter((l) => l.status === 'SENT').map((l) => l.channel),
      ),
    ];
    return {
      id: event.id,
      title: event.title,
      body: event.body,
      description: event.description ?? null,
      readAt: event.readAt,
      voided: event.voided,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      userId: event.userId,
      templateId: event.templateId,
      status,
      channelsSent,
      logCount: event.logs.length,
    };
  }
}
