import {
  NotificationChannel,
  NotificationStatus,
} from '../../generated/prisma/enums';
import { NotificationLog } from '../../generated/prisma/client';
import { JsonValue } from '../../generated/prisma/internal/prismaNamespace';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import { NotificationPriority } from './notification.interfaces';
import { QueryBuilderSchema } from '../common/query-builder';
import { ApiProperty } from '@nestjs/swagger';

export const TestNotificationSchema = z.object({
  templateKey: z.string().nonempty('Template key is required').optional(),
  inlineContent: z
    .object({
      email: z
        .object({
          subject: z.string(),
          html: z.string(),
        })
        .optional(),
      sms: z
        .object({
          body: z.string(),
        })
        .optional(),
      push: z
        .object({
          title: z.string(),
          body: z.string(),
          data: z.record(z.string(), z.any()).optional(),
        })
        .optional(),
    })
    .optional(),
  channels: z.enum(NotificationChannel).array().optional(),
  priority: z.enum(NotificationPriority).optional(),
  recipient: z.object({
    email: z.email().optional(),
    phone: z.string().optional(),
    pushTokens: z.array(z.string()).optional(),
    userId: z.string().optional(),
    data: z.record(z.string(), z.any()).optional(),
  }),
});

export class TestNotificationDto extends createZodDto(TestNotificationSchema) {}

export const QueryNotificationLogSchema = QueryBuilderSchema.extend({
  channel: z.enum(NotificationChannel).optional(),
  status: z.enum(NotificationStatus).optional(),
  userId: z.string().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  includeVoided: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional()
    .default(false),
}).partial();

export class QueryNotificationLogDto extends createZodDto(
  QueryNotificationLogSchema,
) {}

export class GetNotificationLogResponseDto implements NotificationLog {
  @ApiProperty()
  id: string;
  @ApiProperty({ nullable: true })
  templateId: string | null;
  @ApiProperty({ enum: NotificationChannel })
  channel: NotificationChannel;
  @ApiProperty()
  provider: string;
  @ApiProperty({ nullable: true })
  recipientId: string | null;
  @ApiProperty()
  to: string;
  @ApiProperty({ nullable: true })
  subject: string | null;
  @ApiProperty()
  body: string;
  @ApiProperty({ enum: NotificationStatus })
  status: NotificationStatus;
  @ApiProperty()
  attempts: number;
  @ApiProperty()
  maxAttempts: number;
  @ApiProperty({ nullable: true })
  lastError: string | null;
  @ApiProperty({ nullable: true })
  metadata: JsonValue;
  @ApiProperty({ nullable: true })
  scheduledAt: Date | null;
  @ApiProperty({ nullable: true })
  sentAt: Date | null;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  voided: boolean;
  @ApiProperty({ nullable: true })
  userId: string | null;
}

export class QueryNotificationLogResponseDto {
  @ApiProperty({ isArray: true, type: GetNotificationLogResponseDto })
  results: GetNotificationLogResponseDto[];

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
