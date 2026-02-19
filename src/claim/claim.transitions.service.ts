import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CancelClaimDto, RejectClaimDto, VerifyClaimDto } from './claim.dto';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
} from '../common/query-builder';

@Injectable()
export class ClaimStatusTransitionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
  ) {}

  async reject(
    claimId: string,
    rejectDto: RejectClaimDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const canReject = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: { in: ['PENDING', 'VERIFIED', 'DISPUTED'] },
      },
    });
    if (!canReject)
      throw new BadRequestException(
        'Can only reject pending, verified or disputed claims',
      );
    return await this.prismaService.claim.update({
      where: { id: claimId },
      data: {
        status: 'REJECTED',
        statusTransitions: {
          create: {
            fromStatus: canReject.status,
            toStatus: 'REJECTED',
            changedById: user?.id,
            comment: rejectDto.comment,
            reason: rejectDto.reason,
          },
        },
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async verify(
    claimId: string,
    verifyDto: VerifyClaimDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const canVerify = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: { in: ['PENDING', 'REJECTED', 'DISPUTED'] },
      },
    });
    if (!canVerify)
      throw new BadRequestException(
        'Can only verify pending, rejected or disputed claims',
      );
    return await this.prismaService.claim.update({
      where: { id: claimId },
      data: {
        status: 'VERIFIED',
        statusTransitions: {
          create: {
            fromStatus: canVerify.status,
            toStatus: 'VERIFIED',
            changedById: user?.id,
            comment: verifyDto.comment,
            reason: verifyDto.reason,
          },
        },
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async cancel(
    claimId: string,
    cancelDto: CancelClaimDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const canCancel = await this.prismaService.claim.findUnique({
      where: {
        id: claimId,
        status: { in: ['PENDING', 'DISPUTED'] },
        userId: user?.id,
      },
    });
    if (!canCancel)
      throw new BadRequestException(
        'Can only cancel your pending or disputed claims',
      );
    return await this.prismaService.claim.update({
      where: { id: claimId },
      data: {
        status: 'CANCELLED',
        statusTransitions: {
          create: {
            fromStatus: canCancel.status,
            toStatus: 'CANCELLED',
            changedById: user?.id,
            comment: cancelDto.comment,
            reason: cancelDto.reason,
          },
        },
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
