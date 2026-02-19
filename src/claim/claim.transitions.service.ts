import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
} from '../common/query-builder';
import { StatusTransitionDto } from '../status-transitions/status-transitions.dto';

@Injectable()
export class ClaimStatusTransitionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
  ) {}

  async reject(
    claimId: string,
    rejectDto: StatusTransitionDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const canReject = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: { in: ['PENDING', 'VERIFIED', 'DISPUTED'] },
      },
      include: {
        match: true,
      },
    });
    if (!canReject)
      throw new BadRequestException(
        'Can only reject pending, verified or disputed claims',
      );
    // Transition status to rejected and update match status to rejected
    return await this.prismaService.$transaction(async (tx) => {
      // Update claim status to rejected and match status to rejected
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: 'REJECTED',
          match: {
            update: {
              where: { id: canReject.matchId },
              data: {
                status: 'REJECTED',
              },
            },
          },
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Find Match rejected reason
      const claimRejectedReason = await tx.transitionReason.findUnique({
        where: {
          entityType_fromStatus_toStatus_code: {
            entityType: 'Match',
            fromStatus: canReject.match.status,
            toStatus: 'REJECTED',
            code: 'CLAIM_REJECTED',
          },
          auto: true,
        },
      });
      // Throw Bad request if reason dont exist
      if (!claimRejectedReason)
        throw new BadRequestException('Claim rejected reason not found');
      // Create transition history
      await tx.statusTransition.createMany({
        data: [
          {
            entityType: 'Claim',
            entityId: claimId,
            fromStatus: canReject.status,
            toStatus: 'REJECTED',
            changedById: user?.id,
            comment: rejectDto.comment,
            reasonId: rejectDto.reason,
          },
          {
            entityType: 'Match',
            entityId: canReject.matchId,
            fromStatus: canReject.match.status,
            toStatus: 'REJECTED',
            changedById: user?.id,
            comment: rejectDto.comment,
            reasonId: claimRejectedReason.id,
          },
        ],
      });
      return claim;
    });
  }

  async verify(
    claimId: string,
    verifyDto: StatusTransitionDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const canVerify = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: { in: ['PENDING', 'REJECTED', 'DISPUTED'] },
      },
      include: {
        match: true,
      },
    });
    if (!canVerify)
      throw new BadRequestException(
        'Can only verify pending, rejected or disputed claims',
      );
    // Verify claim and transition match status to claimed if not claimed
    return await this.prismaService.$transaction(async (tx) => {
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: 'VERIFIED',
          match:
            canVerify.match.status !== 'CLAIMED'
              ? {
                  update: {
                    where: { id: canVerify.matchId },
                    data: {
                      status: 'CLAIMED',
                    },
                  },
                }
              : undefined,
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Create transition history for claim
      await tx.statusTransition.create({
        data: {
          entityType: 'Claim',
          entityId: claimId,
          fromStatus: canVerify.status,
          toStatus: 'VERIFIED',
          changedById: user?.id,
          comment: verifyDto.comment,
          reasonId: verifyDto.reason,
        },
      });
      // Create transition history for match if status is not claimed
      if (canVerify.match.status !== 'CLAIMED') {
        // Get claim verified reason
        const claimVerifiedReason = await tx.transitionReason.findUnique({
          where: {
            entityType_fromStatus_toStatus_code: {
              entityType: 'Match',
              fromStatus: canVerify.match.status,
              toStatus: 'CLAIMED',
              code: 'CLAIM_VERIFIED',
            },
            auto: true,
          },
        });
        // Throw Bad request if reason dont exist
        if (!claimVerifiedReason)
          throw new BadRequestException('Claim verified reason not found');
        await tx.statusTransition.create({
          data: {
            entityType: 'Match',
            entityId: canVerify.matchId,
            fromStatus: canVerify.match.status,
            toStatus: 'CLAIMED',
            changedById: user?.id,
            comment: verifyDto.comment,
            reasonId: claimVerifiedReason.id,
          },
        });
      }
      return claim;
    });
  }

  async cancel(
    claimId: string,
    cancelDto: StatusTransitionDto,
    user: UserSession['user'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query: CustomRepresentationQueryDto,
  ) {
    const canCancel = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: { in: ['PENDING', 'DISPUTED'] },
        userId: user?.id,
      },
      include: {
        match: true,
      },
    });
    if (!canCancel)
      throw new BadRequestException(
        'Can only cancel your pending or disputed claims',
      );
    return await this.prismaService.$transaction(async (tx) => {
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: 'CANCELLED',
          match: {
            update: {
              where: { id: canCancel.matchId },
              data: {
                status: 'PENDING',
              },
            },
          },
        },
        // ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Get user cancelled claim reason
      const userCancelledClaimReason = await tx.transitionReason.findUnique({
        where: {
          entityType_fromStatus_toStatus_code: {
            entityType: 'Match',
            fromStatus: canCancel.match.status,
            toStatus: 'PENDING',
            code: 'USER_CANCELLED_CLAIM',
          },
          auto: true,
        },
      });
      // Throw Bad request if reason dont exist
      if (!userCancelledClaimReason)
        throw new BadRequestException('User cancelled claim reason not found');
      // Create transition history for claim
      await tx.statusTransition.createMany({
        data: [
          {
            entityType: 'Claim',
            entityId: claimId,
            fromStatus: canCancel.status,
            toStatus: 'CANCELLED',
            changedById: user?.id,
            comment: cancelDto.comment,
            reasonId: cancelDto.reason,
          },
          {
            entityType: 'Match',
            entityId: canCancel.matchId,
            fromStatus: canCancel.match.status,
            toStatus: 'PENDING',
            changedById: user?.id,
            comment: cancelDto.comment,
            reasonId: userCancelledClaimReason.id,
          },
        ],
      });

      return claim;
    });
  }
}
