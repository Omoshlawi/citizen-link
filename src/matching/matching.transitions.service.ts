import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
} from '../common/query-builder';
import { UserSession } from '../auth/auth.types';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import { MatchStatus } from 'generated/prisma/enums';

@Injectable()
export class MatchingStatusTransitionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
  ) {}

  /**
   * Reject your pending matches giving reason why
   * @param matchId
   * @param rejectDto
   * @param user
   * @param query
   * @returns
   */
  async reject(
    matchId: string,
    rejectDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query: CustomRepresentationQueryDto,
  ) {
    const canReject = await this.prismaService.match.findUnique({
      where: {
        id: matchId,
        status: { in: [MatchStatus.PENDING] },
        lostDocumentCase: {
          case: {
            userId: user.id,
          },
        },
      },
    });
    if (!canReject)
      throw new BadRequestException('Can only reject your pending matches');
    // Validate reason
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        id: rejectDto.reason,
        entityType: 'Match',
        fromStatus: canReject.status,
        toStatus: MatchStatus.REJECTED,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
    return await this.prismaService.$transaction(async (tx) => {
      // Update match status to rejected and update claim status to pending
      const match = tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.REJECTED,
        },
        //   ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Find Match rejected reason
      await tx.statusTransition.create({
        data: {
          entityType: 'Match',
          entityId: matchId,
          fromStatus: canReject.status,
          toStatus: MatchStatus.REJECTED,
          changedById: user?.id,
          comment: rejectDto.comment,
          reasonId: rejectDto.reason,
        },
      });

      return match;
    });
  }
}
