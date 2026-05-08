import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import dayjs from 'dayjs';
import z from 'zod';

const pastOrTodayDate = z.iso
  .date()
  .refine((val) => !dayjs(val).isAfter(dayjs(), 'day'), {
    message: 'Date cannot be in the future',
  });
import {
  CaseDocumentSchema,
  GetCaseDocumentResponseDto,
} from '../case-documents/case-documents.dto';
import { QueryAddressSchema } from '../address/address.dto';
import { ApiProperty, PickType } from '@nestjs/swagger';
import {
  CustodyStatus,
  DocumentCase,
  ExchangeMethod,
  ExtractionStatus,
  FoundDocumentCase,
  FoundDocumentCaseStatus,
  LostDocumentCase,
  LostDocumentCaseStatus,
} from '../../generated/prisma/client';

export const QueryDocumentCaseSchema = z
  .object({
    ...QueryBuilderSchema.shape,
    search: z.string().optional(),
    caseNumber: z.string().optional(),
    documentType: z.uuid().optional(),
    caseType: z.enum(['FOUND', 'LOST']).optional(),
    status: z
      .enum(['DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'COMPLETED'])
      .optional(),
    fullName: z.string().optional(),
    eventDateFrom: z.iso.date().optional(),
    eventDateTo: z.iso.date().optional(),
    dateReportedFrom: z.iso.date().optional(),
    dateReportedTo: z.iso.date().optional(),
    tags: z.string().array().optional(),
    documentIssuer: z.string().optional(),
    documentNumber: z.string().optional(),
    docuemtExpiryDateFrom: z.iso.date().optional(),
    docuemtExpiryDateTo: z.iso.date().optional(),
    documentIssueDateFrom: z.iso.date().optional(),
    documentIssueDateTo: z.iso.date().optional(),
    userId: z
      .string()
      .optional()
      .describe('Admin only - Query cases for supplied user id'),
    includeVoided: z
      .stringbool({
        truthy: ['true', '1'],
        falsy: ['false', '0'],
      })
      .optional()
      .default(false),
    extractionStatus: z.enum(ExtractionStatus).optional(),
    submissionMethod: z
      .enum([ExchangeMethod.AGENT_PICKUP, ExchangeMethod.STATION_DROPOFF])
      .optional(),
    custodyStatus: z.enum(CustodyStatus).optional(),
    currentStationId: z
      .uuid()
      .optional()
      .describe('Filter found cases by their current custody station'),
    pickupStationId: z
      .uuid()
      .optional()
      .describe(
        `Filter ${ExchangeMethod.STATION_DROPOFF} found cases by their designated pickup station`,
      ),
    collectionArea: z
      .string()
      .optional()
      .describe(
        `Filter ${ExchangeMethod.AGENT_PICKUP} found cases by collection address area.`,
      ),
  })
  .extend(
    QueryAddressSchema.pick({
      level1: true,
      level2: true,
      level3: true,
      level4: true,
      level5: true,
      country: true,
      postalCode: true,
      location: true,
    }).shape,
  );

export const DocumentCaseSchema = z.object({
  documentId: z.string().min(1),
  addressId: z.string().min(1),
  description: z.string().optional(),
  eventDate: z.iso.date(),
  tags: z.string().min(1).array().optional(),
  status: z.enum([
    'ACTIVE',
    'MATCHED',
    'RETURNED',
    'EXPIRED',
    'CLAIMED',
    'PENDING_VERIFICATION',
    'ARCHIVED',
  ]),
});

const FoundDocumentCaseBaseSchema = z.object({
  typeId: z.uuid(),
  addressId: z.uuid(),
  eventDate: pastOrTodayDate,
  tags: z.string().min(1).array().optional(),
  description: z.string().optional(),
  images: z.string().nonempty().array().nonempty().max(2),
  // Optional submission preference — creates a SCHEDULED inbound exchange on case creation
  submissionMethod: z
    .enum([ExchangeMethod.AGENT_PICKUP, ExchangeMethod.STATION_DROPOFF])
    .optional(),
  submissionStationId: z
    .uuid()
    .optional()
    .describe('Drop Off - Partner Station'),
  submissionAddressId: z
    .uuid()
    .optional()
    .describe('Pickup - Collection Address'),
  submissionScheduledAt: z.iso
    .datetime()
    .optional()
    .describe('Scheduled Pickup/Dro off Date and Time'),
});

export const UpdateFoundCaseSubmissionSchema = z
  .object({
    submissionMethod: z.enum([
      ExchangeMethod.STATION_DROPOFF,
      ExchangeMethod.AGENT_PICKUP,
    ]),
    submissionStationId: z.uuid().optional(),
    submissionAddressId: z.uuid().optional(),
    submissionScheduledAt: z.iso.datetime(),
  })
  .superRefine((data, ctx) => {
    if (
      data.submissionMethod === ExchangeMethod.STATION_DROPOFF &&
      !data.submissionStationId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['submissionStationId'],
        message: `A station is required for ${ExchangeMethod.STATION_DROPOFF} submission`,
      });
    }
    if (data.submissionMethod === ExchangeMethod.AGENT_PICKUP) {
      if (!data.submissionAddressId) {
        ctx.addIssue({
          code: 'custom',
          path: ['submissionAddressId'],
          message: `A submission address is required for ${ExchangeMethod.AGENT_PICKUP}`,
        });
      }
    }
    if (!dayjs(data.submissionScheduledAt).isAfter(dayjs())) {
      ctx.addIssue({
        code: 'custom',
        path: ['submissionScheduledAt'],
        message: 'Scheduled time must be a future date and time',
      });
    }
  });

export class UpdateFoundCaseSubmissionDto extends createZodDto(
  UpdateFoundCaseSubmissionSchema,
) {}

export const FoundDocumentCaseSchema = FoundDocumentCaseBaseSchema.superRefine(
  (data, ctx) => {
    if (
      data.submissionMethod === ExchangeMethod.STATION_DROPOFF &&
      !data.submissionStationId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['submissionStationId'],
        message: `A station is required for ${ExchangeMethod.STATION_DROPOFF} submission`,
      });
    }
    if (data.submissionMethod === ExchangeMethod.AGENT_PICKUP) {
      if (!data.submissionAddressId) {
        ctx.addIssue({
          code: 'custom',
          path: ['submissionAddressId'],
          message: `A submission address is required for ${ExchangeMethod.AGENT_PICKUP}`,
        });
      }
    }
    if (data.submissionMethod) {
      if (!data.submissionScheduledAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['submissionScheduledAt'],
          message: 'A scheduled pickup date and time is required',
        });
      } else if (!dayjs(data.submissionScheduledAt).isAfter(dayjs())) {
        ctx.addIssue({
          code: 'custom',
          path: ['submissionScheduledAt'],
          message: 'Scheduled time must be a future date and time',
        });
      }
    }
  },
);
export const LostDocumentCaseSchema = FoundDocumentCaseBaseSchema.omit({
  images: true,
}).extend(CaseDocumentSchema.omit({ images: true }).shape);

export class QueryDocumentCaseDto extends createZodDto(
  QueryDocumentCaseSchema,
) {}

export class CreateFoundDocumentCaseDto extends createZodDto(
  FoundDocumentCaseSchema,
) {}
export class WsCreateFoundDocumentCaseDto extends createZodDto(
  FoundDocumentCaseBaseSchema.extend({
    caseType: z.enum(['FOUND', 'LOST']),
  }),
) {}

export class CreateLostDocumentCaseDto extends createZodDto(
  LostDocumentCaseSchema,
) {}

export class UpdateDocumentCaseDto extends createZodDto(
  FoundDocumentCaseSchema.omit({
    images: true,
    typeId: true,
  }).partial(),
) {}

export class LostDocumentCaseResponseDto implements LostDocumentCase {
  @ApiProperty({
    description:
      'Indicates if the case was created through manual reporting or auto scanning',
  })
  auto!: boolean;
  @ApiProperty()
  id!: string;
  @ApiProperty()
  caseId!: string;
  @ApiProperty({ enum: LostDocumentCaseStatus })
  status!: LostDocumentCaseStatus;
  @ApiProperty()
  createdAt!: Date;
  @ApiProperty()
  updatedAt!: Date;
}

export class SecurityQuestionDto {
  @ApiProperty()
  question!: string;
  @ApiProperty()
  answer!: string;
}

export class FoundDocumentCaseResponseDto implements FoundDocumentCase {
  @ApiProperty()
  createdAt!: Date;
  @ApiProperty()
  updatedAt!: Date;
  @ApiProperty()
  pointAwarded!: number;
  @ApiProperty({ isArray: true, type: SecurityQuestionDto })
  securityQuestion: any;
  @ApiProperty()
  id!: string;
  @ApiProperty()
  caseId!: string;
  @ApiProperty({ enum: FoundDocumentCaseStatus })
  status!: FoundDocumentCaseStatus;
  @ApiProperty({ required: false, enum: CustodyStatus })
  custodyStatus!: CustodyStatus;
  @ApiProperty({ required: false })
  currentStationId!: string | null;
}

export class GetDocumentCaseResponseDto implements DocumentCase {
  @ApiProperty()
  caseNumber!: string;
  @ApiProperty()
  addressId!: string;
  @ApiProperty()
  description!: string | null;
  @ApiProperty()
  eventDate!: Date;
  @ApiProperty()
  tags!: Array<string>;
  @ApiProperty()
  id!: string;
  @ApiProperty()
  userId!: string;
  @ApiProperty()
  createdAt!: Date;
  @ApiProperty()
  updatedAt!: Date;
  @ApiProperty()
  voided!: boolean;
  @ApiProperty({ type: LostDocumentCaseResponseDto })
  lostDocumentCase!: LostDocumentCaseResponseDto;
  @ApiProperty({ type: FoundDocumentCaseResponseDto })
  foundDocumentCase!: FoundDocumentCaseResponseDto;
  @ApiProperty({ type: GetCaseDocumentResponseDto })
  document!: GetCaseDocumentResponseDto;
}

export class QueryDocumentCaseResponseDto {
  @ApiProperty({ isArray: true, type: GetDocumentCaseResponseDto })
  results!: GetDocumentCaseResponseDto[];
  @ApiProperty()
  totalCount!: number;
  @ApiProperty()
  totalPages!: number;
  @ApiProperty()
  currentPage!: number;
  @ApiProperty()
  pageSize!: number;
  @ApiProperty({ type: 'string' })
  next!: string | null;
  @ApiProperty({ type: 'string' })
  prev: string | null | undefined;
}

export class QuerySimilarDocumentCaseResponsesDto extends PickType(
  QueryDocumentCaseResponseDto,
  ['results'],
) {}

export class TimelineEventDto {
  @ApiProperty()
  key!: string;

  @ApiProperty({ nullable: true, type: 'string' })
  timestamp!: string | null;

  @ApiProperty({ enum: ['done', 'active', 'pending'] })
  status!: 'done' | 'active' | 'pending';
}

export class CaseTimelineResponseDto {
  @ApiProperty({ isArray: true, type: TimelineEventDto })
  events!: TimelineEventDto[];
}
