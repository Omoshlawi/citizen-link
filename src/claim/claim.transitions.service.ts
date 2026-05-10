import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
} from '../common/query-builder';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import { InvoiceService } from '../invoice/invoice.service';
import { ClaimStatus } from '../../generated/prisma/enums';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { NotificationPriority } from '../notifications/notification.interfaces';

@Injectable()
export class ClaimStatusTransitionService {
  private readonly logger = new Logger(ClaimStatusTransitionService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
    private readonly invoiceService: InvoiceService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  private async isCurrentClaimLatestClaim(
    claimId: string,
    throwError: boolean = true,
  ) {
    const claim = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
      },
      select: {
        match: {
          select: {
            claims: {
              select: {
                id: true,
                claimNumber: true,
                createdAt: true,
                userId: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
    });
    if (!claim) throw new BadRequestException('Claim not found');
    const isLatest = claim.match.claims[0].id === claimId;
    if (!isLatest && throwError)
      throw new BadRequestException(
        "Invalid claim, can't perfom action on old claim",
      );
    return isLatest;
  }

  /**
   * Reject a claim
   * @param claimId claim id
   * @param rejectDto reason and comment
   * @param user user session
   * @param query custom representation query
   * @param underReview if claim is under review
   * @returns rejected claim
   */
  async reject(
    claimId: string,
    rejectDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
    underReview: boolean = false,
  ) {
    await this.isCurrentClaimLatestClaim(claimId);
    const canReject = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: {
          in: [
            ...(underReview
              ? [ClaimStatus.UNDER_REVIEW]
              : [ClaimStatus.PENDING, ClaimStatus.VERIFIED]),
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
    // validate rejection reason
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        id: rejectDto.reason,
        entityType: 'Claim',
        fromStatus: canReject.status,
        toStatus: ClaimStatus.REJECTED,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
    // Transition status to rejected
    return await this.prismaService.$transaction(async (tx) => {
      // Update claim status to rejected
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.REJECTED,
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Create transition history
      await tx.statusTransition.create({
        data: {
          entityType: 'Claim',
          entityId: claimId,
          fromStatus: canReject.status,
          toStatus: 'REJECTED',
          changedById: user?.id,
          comment: rejectDto.comment,
          reasonId: rejectDto.reason,
        },
      });
      return claim;
    });
  }

  /**
   * Verify a claim
   * @param claimId claim id
   * @param verifyDto reason and comment
   * @param user user session
   * @param query custom representation query
   * @param underReview if claim is under review
   * @returns verified claim
   */
  async verify(
    claimId: string,
    verifyDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
    underReview: boolean = false,
  ) {
    await this.isCurrentClaimLatestClaim(claimId);
    // TODO: dECIDE WEATHER THE ONE WHO TRANSITIONED TO UNDER REVIEW IS ONE TO APPROVE/REJECT
    const canVerify = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: {
          in: [
            ...(underReview
              ? [ClaimStatus.UNDER_REVIEW]
              : [ClaimStatus.PENDING, ClaimStatus.REJECTED]),
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
        `Can only verify ${underReview ? 'under review' : 'pending, rejected or disputed'} claims`,
      );
    // validate verification reason
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        id: verifyDto.reason,
        entityType: 'Claim',
        fromStatus: canVerify.status,
        toStatus: ClaimStatus.VERIFIED,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
    // Verify claim and transition match status to claimed if not claimed
    const result = await this.prismaService.$transaction(async (tx) => {
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.VERIFIED,
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

    // Notify the claimant that their claim is verified and payment is required
    const createdInvoice = await this.prismaService.invoice.findUnique({
      where: { claimId },
      select: { totalAmount: true },
    });
    const docTypeName =
      canVerify.foundDocumentCase.case.document?.type?.name ?? 'document';
    this.notifications
      .sendFromTemplate({
        templateKey: 'notification.claim.verified',
        data: {
          claim: { id: claimId, claimNumber: canVerify.claimNumber },
          invoice: {
            totalAmount: createdInvoice?.totalAmount?.toNumber() ?? 0,
          },
          document: { type: { name: docTypeName } },
        },
        userId: canVerify.userId,
        priority: NotificationPriority.HIGH,
        force: true,
        eventTitle: 'Claim Approved — Payment Required',
        eventBody: `Your claim for ${docTypeName} has been verified. Complete payment to arrange collection.`,
        eventDescription: `Invoice created for claim ${claimId} after claim verification`,
      })
      .catch((e) =>
        this.logger.error(
          `Failed to send claim verified notification for claim ${claimId}`,
          e,
        ),
      );

    return result;
  }

  async cancel(
    claimId: string,
    cancelDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query: CustomRepresentationQueryDto,
  ) {
    await this.isCurrentClaimLatestClaim(claimId);
    const canCancel = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: {
          in: [
            ClaimStatus.PENDING,
            ClaimStatus.DISPUTED, // Withdraw dispute
          ],
        },
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

    // validate cancellation reason
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        id: cancelDto.reason,
        entityType: 'Claim',
        fromStatus: canCancel.status,
        toStatus: ClaimStatus.CANCELLED,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
    return await this.prismaService.$transaction(async (tx) => {
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.CANCELLED,
        },
        // ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
      // Create transition history for claim
      await tx.statusTransition.create({
        data: {
          entityType: 'Claim',
          entityId: claimId,
          fromStatus: canCancel.status,
          toStatus: ClaimStatus.CANCELLED,
          changedById: user?.id,
          comment: cancelDto.comment,
          reasonId: cancelDto.reason,
        },
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
    await this.isCurrentClaimLatestClaim(claimId);
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
    // validate dispute reason
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        id: disputeDto.reason,
        entityType: 'Claim',
        fromStatus: canDispute.status,
        toStatus: ClaimStatus.DISPUTED,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
    return await this.prismaService.$transaction(async (tx) => {
      const claim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.DISPUTED,
        },
        // ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
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
    await this.isCurrentClaimLatestClaim(claimId);
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
    // validate review dispute reason
    const reason = await this.prismaService.transitionReason.findUnique({
      where: {
        id: reviewDisputeDto.reason,
        entityType: 'Claim',
        fromStatus: canReviewDispute.status,
        toStatus: ClaimStatus.UNDER_REVIEW,
      },
    });
    if (!reason) throw new BadRequestException('Invalid reason');
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
