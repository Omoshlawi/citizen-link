import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../query-builder';
import { z } from 'zod';
import { Setting } from '../../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export const SettingSchema = z.object({
  key: z.string(),
  value: z.string(),
  userId: z.string().optional(),
  description: z.string().optional(),
  isPublic: z
    .boolean()
    .optional()
    .describe('Relevant for system settings only'),
  isSystemSetting: z.boolean().optional().default(false),
});

export const SettingObjectSchema = z.object({
  object: z.record(z.string(), z.any()),
  isPublic: z
    .boolean()
    .optional()
    .describe('Relevant for system settings only'),
  isSystemSetting: z.boolean().optional().default(false),
  prefix: z.string().nonempty(),
});
export const QuerySettingsSchema = z.object({
  ...QueryBuilderSchema.shape,
  search: z.string().optional(),
  // includeVoided: z
  //   .stringbool({
  //     truthy: ['true', '1'],
  //     falsy: ['false', '0'],
  //   })
  //   .optional()
  //   .default(false),
  includeSystemSettings: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
  key: z.string().optional(),
  keyPrefix: z.string().optional(),
  userId: z.string().optional().describe('Admin Only - User ID '),
});

export const NotificationSettingsSchema = z.object({
  email: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional()
    .default(true),
  sms: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .default(false),
  push: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .default(false),
  overrides: z
    .record(z.string(), z.record(z.string(), z.boolean()))
    .optional()
    .default({}),
  quietHoursStart: z.coerce.number().default(22),
  quietHoursEnd: z.coerce.number().default(8),
  timezone: z.string().default('UTC'),
});

export class QuerySettingsDto extends createZodDto(QuerySettingsSchema) {}
export class QuerySettingObjectDto extends createZodDto(
  QuerySettingsSchema.pick({
    keyPrefix: true,
    userId: true,
    // includeVoided: true,
  }).required({
    keyPrefix: true,
  }),
) {}

export class SetSettingDto extends createZodDto(
  SettingSchema.omit({ userId: true }),
) {}

export class SetSettingObjectDto extends createZodDto(SettingObjectSchema) {}
export class DeleteSettingDto extends createZodDto(
  z.object({
    keyOrPrefix: z.string().describe('Key or prefix to delete'),
    isSystemSetting: z.boolean().optional().default(false),
  }),
) {}

export class DeleteSettingResponseDto {
  @ApiProperty()
  message: string;
}
export class SaveUserPreferenceDto extends createZodDto(
  NotificationSettingsSchema,
) {}
export class GetSettingResponseDto implements Setting {
  @ApiProperty()
  value: string;
  @ApiProperty()
  id: string;
  @ApiProperty()
  key: string;
  @ApiProperty({})
  userId: string;
  @ApiProperty({ required: false, nullable: true })
  description: string | null;
  @ApiProperty()
  isPublic: boolean;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  updatedBy: string | null;
  @ApiProperty()
  voided: boolean;
}

export class QuerySettingsResponseDto {
  @ApiProperty({ isArray: true, type: GetSettingResponseDto })
  results: GetSettingResponseDto[];

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
