import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
} from '../common/query-builder';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import { InvoiceService } from '../invoice/invoice.service';
import { ClaimStatus, MatchStatus } from '../../generated/prisma/enums';

@Injectable()
export class ClaimStatusTransitionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async reject(
    claimId: string,
    rejectDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
    underReview: boolean = false,
  ) {
    const canReject = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: {
          in: [
            ...(underReview
              ? [ClaimStatus.UNDER_REVIEW]
              : [
                  ClaimStatus.PENDING,
                  ClaimStatus.VERIFIED,
                  ClaimStatus.DISPUTED,
                ]),
          ],
        },
      },
      include: {
        match: true,
      },
    });
    if (!canReject)
      throw new BadRequestException(
        `Can only reject ${underReview ? 'under review' : 'pending, verified or disputed'} claims`,
      );
    // Transition status to rejected and update match status to rejected
    return await this.prismaService.$transaction(async (tx) => {
      // Update claim status to rejected and match status to rejected
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.REJECTED,
          match: {
            update: {
              where: { id: canReject.matchId },
              data: {
                status: MatchStatus.REJECTED,
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
    verifyDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
    underReview: boolean = false,
  ) {
    const canVerify = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: {
          in: [
            ...(underReview
              ? [ClaimStatus.UNDER_REVIEW]
              : [
                  ClaimStatus.PENDING,
                  ClaimStatus.REJECTED,
                  ClaimStatus.DISPUTED,
                ]),
          ],
        },
      },
      include: {
        match: true,
        foundDocumentCase: {
          select: {
            case: {
              select: {
                document: {
                  select: {
                    type: true,
                  },
                },
              },
            },
          },
        },
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
          status: ClaimStatus.VERIFIED,
          match:
            canVerify.match.status !== MatchStatus.CLAIMED
              ? {
                  update: {
                    where: { id: canVerify.matchId },
                    data: {
                      status: MatchStatus.CLAIMED,
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
          toStatus: ClaimStatus.VERIFIED,
          changedById: user?.id,
          comment: verifyDto.comment,
          reasonId: verifyDto.reason,
        },
      });
      // Create transition history for match if status is not claimed
      if (canVerify.match.status !== MatchStatus.CLAIMED) {
        // Get claim verified reason
        const claimVerifiedReason = await tx.transitionReason.findUnique({
          where: {
            entityType_fromStatus_toStatus_code: {
              entityType: 'Match',
              fromStatus: canVerify.match.status,
              toStatus: MatchStatus.CLAIMED,
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
            toStatus: MatchStatus.CLAIMED,
            changedById: user?.id,
            comment: verifyDto.comment,
            reasonId: claimVerifiedReason.id,
          },
        });
      }
      // Create invoice for the claim if dont already exist
      const invoice = await tx.invoice.findUnique({
        where: { claimId },
      });
      if (!invoice) {
        await this.invoiceService.create(
          {
            claimId,
          },
          {},
          {
            prismaClient: tx,
            throwIfInvoiceExists: true,
          },
        );
      }
      return claim;
    });
  }

  async cancel(
    claimId: string,
    cancelDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query: CustomRepresentationQueryDto,
  ) {
    const canCancel = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: { in: [ClaimStatus.PENDING, ClaimStatus.DISPUTED] },
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
          status: ClaimStatus.CANCELLED,
          match: {
            update: {
              where: { id: canCancel.matchId },
              data: {
                status: MatchStatus.PENDING,
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
            toStatus: MatchStatus.PENDING,
            code: 'CLAIMANT_CANCELLED_CLAIM',
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
            toStatus: ClaimStatus.CANCELLED,
            changedById: user?.id,
            comment: cancelDto.comment,
            reasonId: cancelDto.reason,
          },
          {
            entityType: 'Match',
            entityId: canCancel.matchId,
            fromStatus: canCancel.match.status,
            toStatus: MatchStatus.PENDING,
            changedById: user?.id,
            comment: cancelDto.comment,
            reasonId: userCancelledClaimReason.id,
          },
        ],
      });

      return claim;
    });
  }

  async dispute(
    claimId: string,
    disputeDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query: CustomRepresentationQueryDto,
  ) {
    const canDispute = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: { in: [ClaimStatus.REJECTED] },
        userId: user?.id,
      },
      include: {
        match: true,
      },
    });
    if (!canDispute)
      throw new BadRequestException('Can only dispute your rejected claims');
    return await this.prismaService.$transaction(async (tx) => {
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.DISPUTED,
        },
        // ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      //  TODO: Validate the reason
      // Create transition history for claim
      await tx.statusTransition.create({
        data: {
          entityType: 'Claim',
          entityId: claimId,
          fromStatus: canDispute.status,
          toStatus: ClaimStatus.DISPUTED,
          changedById: user?.id,
          comment: disputeDto.comment,
          reasonId: disputeDto.reason,
        },
      });
      return claim;
    });
  }

  async reviewDispute(
    claimId: string,
    reviewDisputeDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query: CustomRepresentationQueryDto,
  ) {
    const canReviewDispute = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: { in: [ClaimStatus.DISPUTED] },
      },
      include: {
        match: true,
      },
    });
    if (!canReviewDispute)
      throw new BadRequestException('Can only review disputed claims');
    return await this.prismaService.$transaction(async (tx) => {
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.UNDER_REVIEW,
        },
        // ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      //  TODO: Validate the reason
      // Create transition history for claim
      await tx.statusTransition.create({
        data: {
          entityType: 'Claim',
          entityId: claimId,
          fromStatus: canReviewDispute.status,
          toStatus: ClaimStatus.UNDER_REVIEW,
          changedById: user?.id,
          comment: reviewDisputeDto.comment,
          reasonId: reviewDisputeDto.reason,
        },
      });
      return claim;
    });
  }
}
