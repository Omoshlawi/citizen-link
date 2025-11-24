import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomRepresentationService } from 'src/query-builder/representation.service';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../query-builder';
import {
  CreateCaseDocumentDto,
  QueryCaseDocumentDto,
  UpdateCaseDocumentDto,
} from './case-documents.dto';
import { pick } from 'lodash';
import dayjs from 'dayjs';
@Injectable()
export class CaseDocumentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  create(
    createCaseDocumentDto: CreateCaseDocumentDto,
    query: CustomRepresentationQueryDto,
    caseId: string,
  ) {
    const { images, additionalFields, ...data } = createCaseDocumentDto;

    return this.prismaService.document.create({
      data: {
        ...data,
        caseId,
        images: images?.length
          ? {
              createMany: {
                data: images,
              },
            }
          : undefined,
        additionalFields: additionalFields?.length
          ? {
              createMany: {
                data: additionalFields,
              },
            }
          : undefined,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async findAll(
    query: QueryCaseDocumentDto,
    caseId: string,
    originalUrl: string,
  ) {
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.document.findMany
    > = {
      where: {
        AND: [
          {
            caseId,
            voided: query?.includeVoided ? undefined : false,
            batchNumber: query?.batchNumber,
            documentNumber: query?.documentNumber,
            serialNumber: query?.serialNumber,
            issuer: query?.issuer,
            ownerName: query?.ownerName,
            dateOfBirth: query?.dateOfBirth
              ? dayjs(query?.dateOfBirth).toDate()
              : undefined,
            placeOfBirth: query?.placeOfBirth,
            placeOfIssue: query?.placeOfIssue,
            gender: query?.gender,
            nationality: query?.nationality,
            issuanceDate: query?.issuanceDate
              ? dayjs(query?.issuanceDate).toDate()
              : undefined,
            expiryDate: query?.expiryDate
              ? dayjs(query?.expiryDate).toDate()
              : undefined,
            typeId: query?.typeId,
          },
          {
            OR: query.search
              ? [
                  { documentNumber: { contains: query?.search } },
                  { serialNumber: { contains: query?.search } },
                  { batchNumber: { contains: query?.search } },
                  { issuer: { contains: query?.search } },
                  { ownerName: { contains: query?.search } },
                ]
              : undefined,
          },
        ],
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.document.findMany(dbQuery),
      this.prismaService.document.count(pick(dbQuery, 'where')),
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

  async findOne(
    documentId: string,
    query: CustomRepresentationQueryDto,
    caseId: string,
  ) {
    const data = await this.prismaService.document.findUnique({
      where: { id: documentId, caseId },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Document not found');
    return data;
  }

  async update(
    documentId: string,
    updateCaseDocumentDto: UpdateCaseDocumentDto,
    query: CustomRepresentationQueryDto,
    caseId: string,
  ) {
    const { images, additionalFields, ...data } = updateCaseDocumentDto;
    return this.prismaService.document.update({
      where: { id: documentId, voided: false, caseId },
      data: {
        ...data,
        images: images?.length
          ? {
              deleteMany: {
                documentId: documentId,
              },
              createMany: {
                data: images,
              },
            }
          : undefined,
        additionalFields: additionalFields?.length
          ? {
              deleteMany: { documentId: documentId },
              createMany: { data: additionalFields },
            }
          : undefined,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async remove(documentId: string, query: DeleteQueryDto, caseId: string) {
    if (query?.purge) {
      return this.prismaService.document.delete({
        where: { id: documentId, caseId },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      return this.prismaService.document.update({
        where: { id: documentId, caseId, voided: false },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
  }

  async restore(
    documentId: string,
    query: CustomRepresentationQueryDto,
    caseId: string,
  ) {
    return this.prismaService.document.update({
      where: { id: documentId, caseId, voided: true },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
