import { Injectable, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import { CustomRepresentationService } from 'src/query-builder/representation.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomRepresentationQueryDto } from '../query-builder';
import { UpdateCaseDocumentDto } from './case-documents.dto';
@Injectable()
export class CaseDocumentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
  ) {}

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
    const { additionalFields, ...data } = updateCaseDocumentDto;
    return this.prismaService.document.update({
      where: { id: documentId, caseId },
      data: {
        ...data,
        dateOfBirth: data?.dateOfBirth
          ? dayjs(data?.dateOfBirth).toDate()
          : undefined,
        issuanceDate: data?.issuanceDate
          ? dayjs(data?.issuanceDate).toDate()
          : undefined,
        expiryDate: data?.expiryDate
          ? dayjs(data?.expiryDate).toDate()
          : undefined,
        additionalFields: additionalFields
          ? {
              deleteMany: { documentId: documentId },
              createMany: { data: additionalFields },
            }
          : undefined,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
