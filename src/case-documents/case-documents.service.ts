import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import { CustomRepresentationService } from '../common/query-builder/representation.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomRepresentationQueryDto } from '../common/query-builder';
import { UpdateCaseDocumentDto } from './case-documents.dto';
import {
  FoundDocumentCaseStatus,
  LostDocumentCaseStatus,
} from '../../generated/prisma/enums';
import { EmbeddingService } from '../ai/embeding.service';
@Injectable()
export class CaseDocumentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly representationService: CustomRepresentationService,
    private readonly embedService: EmbeddingService,
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

  private async canUpdateCase(caseId: string) {
    const documentCase = await this.prismaService.documentCase.findUnique({
      where: { id: caseId },
      select: {
        lostDocumentCase: true,
        foundDocumentCase: true,
      },
    });
    if (!documentCase) {
      throw new NotFoundException('Document case not found');
    }
    if (
      documentCase.lostDocumentCase &&
      documentCase.lostDocumentCase.status === LostDocumentCaseStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Cant Update Lost Document Case that is completed',
      );
    }
    if (
      documentCase.foundDocumentCase &&
      documentCase.foundDocumentCase.status !== FoundDocumentCaseStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Cant Update Found Document Case that is not in draft status',
      );
    }
  }

  async update(
    documentId: string,
    updateCaseDocumentDto: UpdateCaseDocumentDto,
    query: CustomRepresentationQueryDto,
    caseId: string,
  ) {
    const { additionalFields, ...data } = updateCaseDocumentDto;
    const doc = await this.prismaService.document.update({
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
    await this.embedService.indexDocument(documentId);
    return doc;
  }
}
