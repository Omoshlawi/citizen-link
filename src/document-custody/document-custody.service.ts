import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentOperationItemStatus,
  DocumentOperationStatus,
  Prisma,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { HumanIdService } from '../human-id/human-id.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddOperationItemDto,
  CancelOperationDto,
  CreateDocumentOperationDto,
  QueryDocumentOperationsListDto,
  RejectOperationDto,
  SkipOperationItemDto,
  UpdateDocumentOperationDto,
} from './document-custody.dto';
import { DEFAULT_OPERATION_REP } from './document-custody.constants';
import { DocumentCustodyTransitionsService } from './document-custody-transitions.service';
import { EntityPrefix } from '../human-id/human-id.constants';

@Injectable()
export class DocumentCustodyService {
  private readonly defaultRep = DEFAULT_OPERATION_REP;

  constructor(
    private readonly prisma: PrismaService,
    private readonly humanId: HumanIdService,
    private readonly paginationService: PaginationService,
    private readonly sortService: SortService,
    private readonly representationService: CustomRepresentationService,
    private readonly transitionsService: DocumentCustodyTransitionsService,
  ) {}

  //  Queries

  async findMany(query: QueryDocumentOperationsListDto, originalUrl: string) {
    const where: Prisma.DocumentOperationWhereInput = {
      AND: [
        {
          ...(query.operationTypeId && {
            operationTypeId: query.operationTypeId,
          }),
          ...(query.status && { status: query.status }),
          ...(query.createdById && { createdById: query.createdById }),
        },
        {
          ...(query.stationId && {
            OR: [
              { stationId: query.stationId },
              { fromStationId: query.stationId },
              { toStationId: query.stationId },
            ],
          }),
        },
        {
          ...(query.search && {
            OR: [
              {
                operationNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                items: {
                  some: {
                    foundCase: {
                      case: {
                        caseNumber: {
                          contains: query.search,
                          mode: 'insensitive',
                        },
                      },
                    },
                  },
                },
              },
            ],
          }),
        },
      ],
    };

    const totalCount = await this.prisma.documentOperation.count({ where });
    const data = await this.prisma.documentOperation.findMany({
      where,
      ...this.representationService.buildCustomRepresentationQuery(
        query.v ?? this.defaultRep,
      ),
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
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

  async findOne(id: string, query?: CustomRepresentationQueryDto) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(
        query?.v ?? this.defaultRep,
      ),
    });
    if (!op) throw new NotFoundException('Operation not found');
    return op;
  }

  /** Operation history for a specific found case (used by CustodyDetailPage). */
  async getHistory(
    foundCaseId: string,
    query: QueryDocumentOperationsListDto,
    originalUrl: string,
  ) {
    const foundCase = await this.prisma.foundDocumentCase.findUnique({
      where: { id: foundCaseId },
    });
    if (!foundCase)
      throw new NotFoundException('Found document case not found');

    const where: Prisma.DocumentOperationWhereInput = {
      items: { some: { foundCaseId } },
    };
    const totalCount = await this.prisma.documentOperation.count({ where });
    const data = await this.prisma.documentOperation.findMany({
      where,
      ...this.representationService.buildCustomRepresentationQuery(
        query.v ?? this.defaultRep,
      ),
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
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

  //  Create / Edit

  async create(
    dto: CreateDocumentOperationDto,
    user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    const opType = await this.prisma.documentOperationType.findUnique({
      where: { id: dto.operationTypeId, voided: false },
    });
    if (!opType)
      throw new BadRequestException('Invalid or voided operation type');
    const operationNumber = await this.humanId.generate({
      prefix: opType.prefix as EntityPrefix,
    });

    return this.prisma.documentOperation.create({
      data: {
        operationNumber,
        operationTypeId: dto.operationTypeId,
        status: DocumentOperationStatus.DRAFT,
        stationId: dto.stationId ?? null,
        fromStationId: dto.fromStationId ?? null,
        toStationId: dto.toStationId ?? null,
        requestedByStationId: dto.requestedByStationId ?? null,
        notes: dto.notes ?? null,
        createdById: user.id,
        items: {
          create: dto.foundCaseIds.map((foundCaseId) => ({
            foundCaseId,
            status: DocumentOperationItemStatus.PENDING,
          })),
        },
      },
      ...this.representationService.buildCustomRepresentationQuery(
        query?.v ?? this.defaultRep,
      ),
    });
  }

  async update(
    id: string,
    dto: UpdateDocumentOperationDto,
    _user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
    });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== DocumentOperationStatus.DRAFT)
      throw new ConflictException('Only DRAFT operations can be edited');

    return this.prisma.documentOperation.update({
      where: { id },
      data: {
        ...(dto.stationId !== undefined && { stationId: dto.stationId }),
        ...(dto.fromStationId !== undefined && {
          fromStationId: dto.fromStationId,
        }),
        ...(dto.toStationId !== undefined && { toStationId: dto.toStationId }),
        ...(dto.requestedByStationId !== undefined && {
          requestedByStationId: dto.requestedByStationId,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      ...this.representationService.buildCustomRepresentationQuery(
        query?.v ?? this.defaultRep,
      ),
    });
  }

  // ── Item Management ──────────────────────────────────────────────────────────

  async addItem(
    id: string,
    dto: AddOperationItemDto,
    _user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
    });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== DocumentOperationStatus.DRAFT)
      throw new ConflictException(
        'Items can only be added to DRAFT operations',
      );

    const exists = await this.prisma.documentOperationItem.findUnique({
      where: {
        operationId_foundCaseId: {
          operationId: id,
          foundCaseId: dto.foundCaseId,
        },
      },
    });
    if (exists)
      throw new ConflictException('This document is already in the operation');

    await this.prisma.documentOperationItem.create({
      data: {
        operationId: id,
        foundCaseId: dto.foundCaseId,
        status: DocumentOperationItemStatus.PENDING,
        notes: dto.notes ?? null,
      },
    });

    return this.findOne(id, query);
  }

  async removeItem(
    id: string,
    itemId: string,
    _user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
    });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== DocumentOperationStatus.DRAFT)
      throw new ConflictException(
        'Items can only be removed from DRAFT operations',
      );

    const item = await this.prisma.documentOperationItem.findFirst({
      where: { id: itemId, operationId: id },
    });
    if (!item) throw new NotFoundException('Operation item not found');

    await this.prisma.documentOperationItem.delete({ where: { id: itemId } });
    return this.findOne(id, query);
  }

  async skipItem(
    id: string,
    itemId: string,
    dto: SkipOperationItemDto,
    _user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
    });
    if (!op) throw new NotFoundException('Operation not found');
    if (
      op.status !== DocumentOperationStatus.DRAFT &&
      op.status !== DocumentOperationStatus.APPROVED
    )
      throw new ConflictException(
        'Items can only be skipped on DRAFT or APPROVED operations',
      );

    const item = await this.prisma.documentOperationItem.findFirst({
      where: { id: itemId, operationId: id },
    });
    if (!item) throw new NotFoundException('Operation item not found');
    if (item.status !== DocumentOperationItemStatus.PENDING)
      throw new ConflictException('Only PENDING items can be skipped');

    await this.prisma.documentOperationItem.update({
      where: { id: itemId },
      data: {
        status: DocumentOperationItemStatus.SKIPPED,
        notes: dto.comment ?? item.notes,
      },
    });
    return this.findOne(id, query);
  }

  //  Lifecycle Transitions (delegated)

  submit(
    id: string,
    user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    return this.transitionsService.submit(id, user, query?.v);
  }

  approve(
    id: string,
    user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    return this.transitionsService.approve(id, user, query?.v);
  }

  reject(
    id: string,
    dto: RejectOperationDto,
    user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    return this.transitionsService.reject(id, dto, user, query?.v);
  }

  execute(
    id: string,
    user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    return this.transitionsService.execute(id, user, query?.v);
  }

  cancel(
    id: string,
    dto: CancelOperationDto,
    user: UserSession['user'],
    query?: CustomRepresentationQueryDto,
  ) {
    return this.transitionsService.cancel(id, dto, user, query?.v);
  }
}
