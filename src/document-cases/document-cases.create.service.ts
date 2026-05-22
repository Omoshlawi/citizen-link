import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { parseDate } from '../app.utils';
import { UserSession } from '../auth/auth.types';
import { CustomRepresentationQueryDto } from '../common/query-builder';
import { TextExtractionOutputDto } from '../extraction/extraction.dto';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { DocumentCasesQueryService } from './document-cases.query.service';

@Injectable()
export class DocumentCasesCreateService {
  private readonly logger = new Logger(DocumentCasesCreateService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly s3Service: S3Service,
    private readonly documentCasesQueryService: DocumentCasesQueryService,
  ) {}

  async filesExists(images: string[], onFailed?: () => void): Promise<void> {
    this.logger.debug('Checking if images exist', images);
    const exists = await Promise.all(
      images.map((image) => this.s3Service.fileExists(image, 'tmp')),
    );
    const allExists = exists.every(Boolean);
    if (!allExists) {
      if (!onFailed)
        throw new BadRequestException('One or more images do not exist');
      else onFailed();
    }
    this.logger.debug('All images exist');
  }

  moveAndGenerateBluredVersions(images: Array<string>, caseNumber: string) {
    return Promise.all(
      images.map(async (image) => {
        const caseImageKey = `${caseNumber}/${image}`;

        // Generate blured version and save to case bucket
        const buffer = await this.s3Service.downloadFile(image, 'tmp');
        const metadata = await this.s3Service.getFileMetadata(image, 'tmp');
        const mimeType =
          metadata?.ContentType ?? `image/${image.split('.').pop()}`;
        const bluredKey = `${caseNumber}/${this.s3Service.generateFileName(image)}`;
        const bluredBuffer = await this.s3Service.blueImage(buffer, 'strong');
        await this.s3Service.uploadFile(
          bluredKey,
          'cases',
          bluredBuffer,
          mimeType,
          {
            isBlurred: 'true',
            originalKey: caseImageKey,
          },
        );

        // Move file from tmp to cases
        await this.s3Service.moveFileToCasesBucket(image, caseNumber);
        return await this.prismaService.documentImage.update({
          where: { document: { case: { caseNumber } }, url: image },
          data: {
            url: caseImageKey,
            blurredUrl: bluredKey,
          },
        });
      }),
    );
  }

  // runVisionStep and runTextStep removed — docai owns all AI extraction steps.
  // Docai submits jobs to citizen-link-docai and receives VISION/COMPLETED/FAILED
  // webhooks via DocaiWebhookService.

  findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    return this.documentCasesQueryService.findOne(id, query, user);
  }

  /**
   * Applies extracted text output to a Document — only fills currently null/empty fields.
   * Also sets the document type if not yet set.
   * Returns the fields that were updated.
   */
  async applyExtractionToDocument(
    documentId: string,
    documentData: TextExtractionOutputDto,
  ): Promise<void> {
    const existing = await this.prismaService.document.findUnique({
      where: { id: documentId },
      select: {
        documentNumber: true,
        serialNumber: true,
        batchNumber: true,
        fullName: true,
        surname: true,
        givenNames: true,
        dateOfBirth: true,
        placeOfBirth: true,
        gender: true,
        issuer: true,
        placeOfIssue: true,
        issuanceDate: true,
        expiryDate: true,
        addressRaw: true,
        addressCountry: true,
        addressComponents: true,
        fingerprintPresent: true,
        photoPresent: true,
        signaturePresent: true,
      },
    });

    if (!existing) {
      this.logger.warn(
        `Document ${documentId} not found — skipping extraction apply`,
      );
      return;
    }

    const update: Record<string, unknown> = {};

    const setIfNull = <T>(
      currentVal: T | null | undefined,
      extractedVal: T | null | undefined,
      key: string,
    ) => {
      if (
        (currentVal === null || currentVal === undefined) &&
        extractedVal != null
      ) {
        update[key] = extractedVal;
      }
    };

    setIfNull(
      existing.documentNumber,
      documentData.document?.number,
      'documentNumber',
    );
    setIfNull(
      existing.serialNumber,
      documentData.document?.serialNumber,
      'serialNumber',
    );
    setIfNull(
      existing.batchNumber,
      documentData.document?.batchNumber,
      'batchNumber',
    );
    setIfNull(existing.fullName, documentData.person?.fullName, 'fullName');
    setIfNull(existing.surname, documentData.person?.surname, 'surname');
    setIfNull(
      existing.placeOfBirth,
      documentData.person?.placeOfBirth,
      'placeOfBirth',
    );
    setIfNull(existing.gender, documentData.person?.gender, 'gender');
    setIfNull(existing.issuer, documentData.document?.issuer, 'issuer');
    setIfNull(
      existing.placeOfIssue,
      documentData.document?.placeOfIssue,
      'placeOfIssue',
    );
    setIfNull(existing.addressRaw, documentData.address?.raw, 'addressRaw');
    setIfNull(
      existing.addressCountry,
      documentData.address?.country,
      'addressCountry',
    );

    // Arrays — treat empty array as "not provided"
    if (
      (!existing.givenNames || existing.givenNames.length === 0) &&
      documentData.person?.givenNames?.length
    ) {
      update['givenNames'] = documentData.person.givenNames;
    }

    if (
      (!existing.addressComponents ||
        (Array.isArray(existing.addressComponents) &&
          existing.addressComponents.length === 0)) &&
      documentData.address?.components?.length
    ) {
      update['addressComponents'] = documentData.address.components;
    }

    // Dates
    setIfNull(
      existing.dateOfBirth,
      parseDate(documentData.person?.dateOfBirth),
      'dateOfBirth',
    );
    setIfNull(
      existing.issuanceDate,
      parseDate(documentData.document?.issueDate),
      'issuanceDate',
    );

    const extractedExpiry = parseDate(documentData.document?.expiryDate);
    setIfNull(existing.expiryDate, extractedExpiry, 'expiryDate');
    if (extractedExpiry && !existing.expiryDate) {
      update['isExpired'] = dayjs(extractedExpiry).isBefore(dayjs());
    }

    // Biometric flags — only promote false→true; never demote a confirmed true
    if (
      !existing.fingerprintPresent &&
      documentData.biometrics?.fingerprintPresent
    ) {
      update['fingerprintPresent'] = true;
    }
    if (!existing.photoPresent && documentData.biometrics?.photoPresent) {
      update['photoPresent'] = true;
    }
    if (
      !existing.signaturePresent &&
      documentData.biometrics?.signaturePresent
    ) {
      update['signaturePresent'] = true;
    }

    // Additional fields — append only
    const additionalFieldsToAdd =
      documentData.additionalFields?.filter(
        (f) => f.fieldName && f.fieldValue,
      ) ?? [];

    if (Object.keys(update).length > 0 || additionalFieldsToAdd.length > 0) {
      await this.prismaService.document.update({
        where: { id: documentId },
        data: {
          ...update,
          ...(additionalFieldsToAdd.length > 0 && {
            additionalFields: {
              createMany: {
                skipDuplicates: true,
                data: additionalFieldsToAdd.map((f) => ({
                  fieldName: f.fieldName,
                  fieldValue: f.fieldValue,
                })),
              },
            },
          }),
        },
      });
      this.logger.debug(
        `Applied ${Object.keys(update).length} field(s) from extraction to document ${documentId}`,
      );
    }
  }
}
