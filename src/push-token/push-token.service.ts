import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserSession } from '../auth/auth.types';
import { QueryPushTokenDto, SetPushTokenDto } from './push-token.dto';
import { Prisma, UserPushToken } from '../../generated/prisma/client';
import { isSuperUser } from 'src/app.utils';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  PaginationService,
} from '../common/query-builder';
import { CustomRepresentationService } from '../common/query-builder/representation.service';
import { SortService } from '../common/query-builder/sort.service';

@Injectable()
export class PushTokenService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  async findAll(
    query: QueryPushTokenDto,
    user: UserSession['user'],
    originalUrl: string,
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: Prisma.UserPushTokenWhereInput = {
      AND: [
        {
          voided: query?.includeVoided ? undefined : false,
          userId: isAdmin ? (query?.userId ?? user.id) : user.id,
          provider: query?.provider,
        },
      ],
    };
    const totalCount = await this.prismaService.userPushToken.count({
      where: dbQuery,
    });
    const data = await this.prismaService.userPushToken.findMany({
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

  async remove(
    token: string,
    user: UserSession['user'],
    query: DeleteQueryDto,
  ) {
    const isAdmin = isSuperUser(user);
    let data: UserPushToken;
    if (query?.purge) {
      data = await this.prismaService.userPushToken.delete({
        where: { token, userId: isAdmin ? undefined : user.id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prismaService.userPushToken.update({
        where: { token, userId: isAdmin ? undefined : user.id },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return data;
  }

  async restore(
    token: string,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const isAdmin = isSuperUser(user);
    const data = await this.prismaService.userPushToken.update({
      where: { token, userId: isAdmin ? undefined : user.id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }

  async setPushToken(
    { token, ...dto }: SetPushTokenDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const data = await this.prismaService.userPushToken.upsert({
      where: {
        token: token,
      },
      update: dto,
      create: {
        token,
        userId: user.id,
        ...dto,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }

  /**
   * For internal use only
   * Get all active push tokens for a user */
  async getPushTokens(userId: string): Promise<string[]> {
    const tokens = await this.prismaService.userPushToken.findMany({
      where: { userId, voided: false },
      select: { token: true },
    });
    return tokens.map((t) => t.token);
  }

  /**
   * For internal use only
   * Deactivate a push token (e.g. after Expo returns DeviceNotRegistered) */
  async deactivatePushToken(token: string) {
    await this.prismaService.userPushToken.updateMany({
      where: { token },
      data: { voided: true },
    });
  }
}
