import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserSession } from '../auth/auth.types';
import { isSuperUser } from '../app.utils';
import { DeleteQueryDto, PaginationService } from '../common/query-builder';
import { CustomRepresentationService } from '../common/query-builder/representation.service';
import { SortService } from '../common/query-builder/sort.service';
import { QueryNotificationLogDto } from './notification.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  async findAll(
    query: QueryNotificationLogDto,
    user: UserSession['user'],
    originalUrl: string,
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: Prisma.NotificationLogWhereInput = {
      AND: [
        {
          userId: isAdmin ? (query?.userId ?? undefined) : user.id,
          channel: query?.channel,
          status: query?.status,
          createdAt: {
            gte: query?.from,
            lte: query?.to,
          },
        },
      ],
    };
    const totalCount = await this.prisma.notificationLog.count({
      where: dbQuery,
    });
    const data = await this.prisma.notificationLog.findMany({
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

  async findOne(id: string, user: UserSession['user']) {
    const isAdmin = isSuperUser(user);
    const log = await this.prisma.notificationLog.findUnique({
      where: { id },
    });
    if (!log) {
      throw new NotFoundException(`Notification log ${id} not found`);
    }
    if (!isAdmin && log.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    return log;
  }

  async remove(id: string, user: UserSession['user'], query: DeleteQueryDto) {
    const isAdmin = isSuperUser(user);
    const log = await this.prisma.notificationLog.findUnique({
      where: { id },
    });
    if (!log) {
      throw new NotFoundException(`Notification log ${id} not found`);
    }
    if (!isAdmin) {
      throw new ForbiddenException('Access denied');
    }
    return this.prisma.notificationLog.delete({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
