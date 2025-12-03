/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { pick } from 'lodash';
import {
  ActorType,
  CaseType,
  FoundDocumentCaseStatus,
  LostDocumentCaseStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomRepresentationService,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../query-builder';
import { QueryStatusTransitionDto } from './case-status-transitions.dto';

@Injectable()
export class CaseStatusTransitionsService {
  private readonly logger = new Logger(CaseStatusTransitionsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}
  /**
   * Get status transition history for a case
   */
  async getTransitionHistory(
    caseId: string,
    query: QueryStatusTransitionDto,
    originalUrl: string,
  ) {
    // Verify case exists
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id: caseId },
    });

    if (!documentCase) {
      throw new NotFoundException('Document case not found');
    }

    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.caseStatusTransition.findMany
    > = {
      where: {
        caseId,
        caseType: query.caseType,
        actorType: query.actorType,
        actorId: query.actorId,
        fromStatus: query.fromStatus,
        toStatus: query.toStatus,
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };

    const [data, totalCount] = await Promise.all([
      this.prismaService.caseStatusTransition.findMany(dbQuery),
      this.prismaService.caseStatusTransition.count(pick(dbQuery, 'where')),
    ]);

    return {
      results: data,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  /**
   * Get current status of a case
   */
  async getCurrentStatus(caseId: string): Promise<{
    caseType: CaseType;
    status: FoundDocumentCaseStatus | LostDocumentCaseStatus;
    caseId: string;
  }> {
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id: caseId },
      include: {
        lostDocumentCase: true,
        foundDocumentCase: true,
      },
    });

    if (!documentCase) {
      throw new NotFoundException('Document case not found');
    }

    if (documentCase.foundDocumentCase) {
      return {
        caseType: CaseType.FOUND,
        status: documentCase.foundDocumentCase.status,
        caseId,
      };
    }

    if (documentCase.lostDocumentCase) {
      return {
        caseType: CaseType.LOST,
        status: documentCase.lostDocumentCase.status,
        caseId,
      };
    }

    throw new BadRequestException('Case has no status');
  }

  async transitionStatus(
    caseId: string,
    toStatus: FoundDocumentCaseStatus | LostDocumentCaseStatus,
    actorType: ActorType,
    actorId: string,
    metadata?: {
      deviceId?: string;
      deviceLocation?: string;
      deviceMetadata?: Record<string, unknown>;
      verificationResult?: Record<string, unknown>;
      notes?: string;
    },
  ) {
    // 1. Get current status
    const currentStatus = await this.getCurrentStatus(caseId);
    if (currentStatus.status === toStatus) {
      throw new BadRequestException('Cannot transition to the same status');
    }
    // 2. Validate transition is allowed (DRAFT -> SUBMITTED, SUBMITTED -> VERIFIED, etc.)
    if (currentStatus.caseType === CaseType.FOUND) {
      // FOUND DOCUMENT CASE TRANSITIONS
      if (
        currentStatus.status === FoundDocumentCaseStatus.DRAFT &&
        toStatus !== FoundDocumentCaseStatus.SUBMITTED
      ) {
        throw new BadRequestException(
          'Invalid transition from DRAFT to ' +
            toStatus +
            ' for found document case. Allowed transitions are: DRAFT -> SUBMITTED',
        );
      }
      if (
        currentStatus.status === FoundDocumentCaseStatus.SUBMITTED &&
        toStatus !== FoundDocumentCaseStatus.VERIFIED &&
        toStatus !== FoundDocumentCaseStatus.REJECTED
      ) {
        throw new BadRequestException(
          'Invalid transition from SUBMITTED to ' +
            toStatus +
            ' for found document case. Allowed transitions are: SUBMITTED -> VERIFIED or SUBMITTED -> REJECTED',
        );
      }
      if (
        currentStatus.status === FoundDocumentCaseStatus.VERIFIED &&
        toStatus !== FoundDocumentCaseStatus.COMPLETED
      ) {
        throw new BadRequestException(
          'Invalid transition from VERIFIED to ' +
            toStatus +
            ' for found document case. Allowed transitions are: VERIFIED -> COMPLETED',
        );
      }
    } else {
      // LOST DOCUMENT CASE TRANSITIONS
      if (
        currentStatus.status === LostDocumentCaseStatus.SUBMITTED &&
        toStatus !== LostDocumentCaseStatus.COMPLETED
      ) {
        throw new BadRequestException(
          'Invalid transition from SUBMITTED to ' +
            toStatus +
            ' for lost document case. Allowed transitions are: SUBMITTED -> MATCHED',
        );
      }
    }

    // 3. Update the case status
    await this.prismaService.documentCase.update({
      where: { id: caseId },
      data: {
        [currentStatus.caseType === CaseType.FOUND
          ? 'foundDocumentCase'
          : 'lostDocumentCase']: {
          update: {
            status: toStatus,
          },
        },
      },
    });
    // 4. Create CaseStatusTransition record for audit
    await this.prismaService.caseStatusTransition.create({
      data: {
        caseId,
        caseType: currentStatus.caseType,
        fromStatus: currentStatus.status,
        toStatus,
        actorType,
        actorId,
        actorName: actorType === ActorType.USER ? actorId : undefined,
        deviceId: actorType === ActorType.DEVICE ? actorId : undefined,
        notes: metadata?.notes,
        deviceLocation: metadata?.deviceLocation,
        deviceMetadata: metadata?.deviceMetadata as any,
        verificationResult: metadata?.verificationResult as any,
        metadata: metadata as any,
      },
    });
    // 5. Return updated case
  }
}
