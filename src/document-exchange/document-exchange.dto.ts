import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import {
  DocumentExchange,
  ExchangeDirection,
  ExchangeMethod,
  ExchangeStatus,
  VerificationStatus,
} from '../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import {
  CustomRepresentationQuerySchema,
  QueryBuilderSchema,
} from '../common/query-builder';
import dayjs from 'dayjs';

// ─── Inbound (finder → station) ───────────────────────────────────────────────

export const ScheduleInboundExchangeSchema = z
  .object({
    foundCaseId: z.uuid(),
    method: z.enum([
      ExchangeMethod.STATION_DROPOFF,
      ExchangeMethod.AGENT_PICKUP,
    ]),
    scheduledAt: z.iso.datetime(),
    stationId: z
      .uuid()
      .optional()
      .describe(`Required for ${ExchangeMethod.STATION_DROPOFF}`),
    addressId: z
      .uuid()
      .optional()
      .describe(`Required for ${ExchangeMethod.AGENT_PICKUP}`),
  })
  .superRefine((data, ctx) => {
    if (data.method === ExchangeMethod.STATION_DROPOFF && !data.stationId) {
      ctx.addIssue({
        code: 'custom',
        path: ['stationId'],
        message: `A station is required for ${ExchangeMethod.STATION_DROPOFF}`,
      });
    }
    if (data.method === ExchangeMethod.AGENT_PICKUP && !data.addressId) {
      ctx.addIssue({
        code: 'custom',
        path: ['addressId'],
        message: `An address is required for ${ExchangeMethod.AGENT_PICKUP}`,
      });
    }
    if (!dayjs(data.scheduledAt).isAfter(dayjs())) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduledAt'],
        message: 'Scheduled time must be a future date and time',
      });
    }
  });

export class ScheduleInboundExchangeDto extends createZodDto(
  ScheduleInboundExchangeSchema,
) {}

export const VerifyExchangeCodeSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
});
export class VerifyExchangeCodeDto extends createZodDto(
  VerifyExchangeCodeSchema,
) {}

export const ConfirmOutboundCodeSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
});
export class ConfirmOutboundCodeDto extends createZodDto(
  ConfirmOutboundCodeSchema,
) {}

export const CancelExchangeSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});
export class CancelExchangeDto extends createZodDto(CancelExchangeSchema) {}

export const CancelVerificationSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});
export class CancelVerificationDto extends createZodDto(
  CancelVerificationSchema,
) {}

// ─── Outbound (station → owner) ───────────────────────────────────────────────

export const ScheduleOutboundExchangeSchema = z
  .object({
    claimId: z.uuid(),
    method: z.enum([
      ExchangeMethod.OWNER_PICKUP,
      ExchangeMethod.INHOUSE_DELIVERY,
      ExchangeMethod.COURIER_DELIVERY,
    ]),
    scheduledAt: z.iso.datetime(),
    stationId: z.uuid().optional().describe('Required for OWNER_PICKUP'),
    addressId: z
      .uuid()
      .optional()
      .describe('Required for INHOUSE_DELIVERY or COURIER_DELIVERY'),
  })
  .superRefine((data, ctx) => {
    if (data.method === ExchangeMethod.OWNER_PICKUP && !data.stationId) {
      ctx.addIssue({
        code: 'custom',
        path: ['stationId'],
        message: `A station is required for ${ExchangeMethod.OWNER_PICKUP}`,
      });
    }
    if (
      (
        [
          ExchangeMethod.INHOUSE_DELIVERY,
          ExchangeMethod.COURIER_DELIVERY,
        ] as Array<string>
      ).includes(data.method) &&
      !data.addressId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['addressId'],
        message: `An address is required for ${ExchangeMethod.INHOUSE_DELIVERY}/${ExchangeMethod.COURIER_DELIVERY}`,
      });
    }
    if (!dayjs(data.scheduledAt).isAfter(dayjs())) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduledAt'],
        message: 'Scheduled time must be a future date and time',
      });
    }
  });

export class ScheduleOutboundExchangeDto extends createZodDto(
  ScheduleOutboundExchangeSchema,
) {}

// ─── Query ────────────────────────────────────────────────────────────────────

export const WithdrawScheduleQuerySchema = z
  .object({
    direction: z.enum(ExchangeDirection),
    foundCaseId: z
      .uuid()
      .optional()
      .describe(`Required for ${ExchangeDirection.INBOUND}`),
    claimId: z
      .uuid()
      .optional()
      .describe(`Required for ${ExchangeDirection.OUTBOUND}`),
  })
  .extend(CustomRepresentationQuerySchema.shape)
  .superRefine((data, ctx) => {
    if (data.direction === ExchangeDirection.INBOUND && !data.foundCaseId) {
      ctx.addIssue({
        code: 'custom',
        path: ['foundCaseId'],
        message: `A found case is required for ${ExchangeDirection.INBOUND}`,
      });
    }
    if (data.direction === ExchangeDirection.OUTBOUND && !data.claimId) {
      ctx.addIssue({
        code: 'custom',
        path: ['claimId'],
        message: `A claim is required for ${ExchangeDirection.OUTBOUND}`,
      });
    }
  });

export class WithdrawScheduleQueryDto extends createZodDto(
  WithdrawScheduleQuerySchema,
) {}

export const IssueCodeQuerySchema = z
  .object({
    direction: z.enum(ExchangeDirection),
    foundCaseId: z
      .uuid()
      .optional()
      .describe(`Required for ${ExchangeDirection.INBOUND}`),
    exchangeNumber: z
      .string()
      .optional()
      .describe(`Required for ${ExchangeDirection.OUTBOUND}`),
  })
  .extend(CustomRepresentationQuerySchema.shape)
  .superRefine((data, ctx) => {
    if (data.direction === ExchangeDirection.INBOUND && !data.foundCaseId) {
      ctx.addIssue({
        code: 'custom',
        path: ['foundCaseId'],
        message: `A found case is required for ${ExchangeDirection.INBOUND}`,
      });
    }
    if (data.direction === ExchangeDirection.OUTBOUND && !data.exchangeNumber) {
      ctx.addIssue({
        code: 'custom',
        path: ['exchangeNumber'],
        message: `An exchange number is required for ${ExchangeDirection.OUTBOUND}`,
      });
    }
  });
export class IssueCodeQueryDto extends createZodDto(IssueCodeQuerySchema) {}
export class VerifyCodeQueryDto extends createZodDto(IssueCodeQuerySchema) {}
export class CancelCodeQueryDto extends createZodDto(IssueCodeQuerySchema) {}

export const QueryExchangeSchema = z.object({
  ...QueryBuilderSchema.shape,
  direction: z.enum(ExchangeDirection).optional(),
  method: z.enum(ExchangeMethod).optional(),
  status: z.enum(ExchangeStatus).optional(),
  foundCaseId: z.uuid().optional(),
  claimId: z.uuid().optional(),
  active: z
    .stringbool({ truthy: ['1', 'true'], falsy: ['0', 'false'] })
    .describe(
      `Queries ${ExchangeStatus.SCHEDULED} and ${ExchangeStatus.IN_PROGRESS} statuses.Ignored when status param is supplied`,
    )
    .optional(),
});
export class QueryExchangeDto extends createZodDto(QueryExchangeSchema) {}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export class IssueVerificationResponseDto {
  @ApiProperty()
  exchangeId!: string;

  @ApiProperty()
  exchangeNumber!: string;

  @ApiProperty()
  verificationId!: string;

  @ApiProperty()
  expiresAt!: Date;
}

export class ActiveExchangeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  exchangeNumber!: string;

  @ApiProperty({ enum: ExchangeStatus })
  status!: ExchangeStatus;

  @ApiProperty()
  scheduledAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  attempts!: number;

  @ApiProperty()
  maxAttempts!: number;

  @ApiProperty({ required: false })
  code?: string;
}

export class GetExchangeResponseDto implements DocumentExchange {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  exchangeNumber!: string;

  @ApiProperty({ enum: ExchangeDirection })
  direction!: ExchangeDirection;

  @ApiProperty({ enum: ExchangeMethod })
  method!: ExchangeMethod;

  @ApiProperty({ enum: ExchangeStatus })
  status!: ExchangeStatus;

  @ApiProperty()
  foundCaseId!: string;

  @ApiProperty({ required: false, nullable: true })
  claimId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  stationId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  addressId!: string | null;

  @ApiProperty()
  scheduledAt!: Date;

  @ApiProperty({ required: false, nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ required: false, nullable: true })
  courierProvider!: string | null;

  @ApiProperty({ required: false, nullable: true })
  trackingNumber!: string | null;

  @ApiProperty({ required: false, nullable: true })
  externalShipmentId!: string | null;

  @ApiProperty()
  createdById!: string;

  @ApiProperty({ required: false, nullable: true })
  completedById!: string | null;

  @ApiProperty({ required: false, nullable: true })
  cancelledById!: string | null;

  @ApiProperty({ required: false, nullable: true })
  cancelReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class QueryExchangeResponseDto {
  @ApiProperty({ isArray: true, type: GetExchangeResponseDto })
  results!: GetExchangeResponseDto[];

  @ApiProperty()
  totalCount!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  currentPage!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty({ required: false, nullable: true })
  next!: string | null;

  @ApiProperty({ required: false, nullable: true })
  prev!: string | null;
}

export class ExchangeVerificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  exchangeId!: string;

  @ApiProperty({ enum: VerificationStatus })
  status!: VerificationStatus;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  attempts!: number;

  @ApiProperty()
  maxAttempts!: number;

  @ApiProperty()
  createdAt!: Date;
}
