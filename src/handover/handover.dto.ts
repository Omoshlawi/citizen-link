import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import {
  Handover,
  HandoverMethod,
  HandoverStatus,
} from '../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export const ScheduleHandoverSchema = z
  .object({
    claimId: z.uuid(),
    method: z.enum(['PICKUP', 'DELIVERY']),
    scheduledDate: z.iso.datetime(),
    pickupStationId: z.uuid().optional(),
    deliveryAddressId: z.uuid().optional(),
  })
  .refine(
    (d) =>
      (d.method === 'PICKUP' && !!d.pickupStationId) ||
      (d.method === 'DELIVERY' && !!d.deliveryAddressId),
    {
      message:
        'Provide pickupStationId for PICKUP method or deliveryAddressId for DELIVERY method',
    },
  );

export const QueryHandoverSchema = z.object({
  ...QueryBuilderSchema.shape,
  claimId: z.uuid().optional(),
  status: z
    .enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
    .optional(),
  method: z.enum(['PICKUP', 'DELIVERY']).optional(),
  scheduledDateFrom: z.iso.date().optional(),
  scheduledDateTo: z.iso.date().optional(),
});

export class ScheduleHandoverDto extends createZodDto(ScheduleHandoverSchema) {}
export class QueryHandoverDto extends createZodDto(QueryHandoverSchema) {}

export class GetHandoverResponseDto implements Handover {
  @ApiProperty()
  id: string;
  @ApiProperty()
  handoverNumber: string;
  @ApiProperty()
  claimId: string;
  @ApiProperty({ enum: HandoverMethod })
  method: HandoverMethod;
  @ApiProperty({ required: false })
  pickupStationId: string | null;
  @ApiProperty({ required: false })
  deliveryAddressId: string | null;
  @ApiProperty()
  scheduledDate: Date;
  @ApiProperty({ required: false })
  completedAt: Date | null;
  @ApiProperty()
  ownerVerified: boolean;
  @ApiProperty({ required: false })
  ownerSignature: string | null;
  @ApiProperty({ required: false })
  handoverNotes: string | null;
  @ApiProperty({ enum: HandoverStatus })
  status: HandoverStatus;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}

export class QueryHandoverResponseDto {
  @ApiProperty({ isArray: true, type: GetHandoverResponseDto })
  results: GetHandoverResponseDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  currentPage: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  next: string | null;

  @ApiProperty()
  prev: string | null;
}
