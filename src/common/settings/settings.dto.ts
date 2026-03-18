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
  includeVoided: z
    .stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
    })
    .optional()
    .default(false),
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

export class QuerySettingsDto extends createZodDto(QuerySettingsSchema) {}
export class QuerySettingObjectDto extends createZodDto(
  QuerySettingsSchema.pick({ keyPrefix: true, userId: true }).required({
    keyPrefix: true,
  }),
) {}

export class SetSettingDto extends createZodDto(
  SettingSchema.omit({ userId: true }),
) {}

export class SetSettingObjectDto extends createZodDto(SettingObjectSchema) {}

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
