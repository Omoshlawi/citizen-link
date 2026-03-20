import { UserPushToken } from '../../generated/prisma/client';
import { createZodDto } from 'nestjs-zod';
import { QueryBuilderSchema } from '../common/query-builder';
import z from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export enum PushTokenProvider {
  FCM = 'fcm',
  APNS = 'apns',
  EXPO = 'expo',
}

export const PushTokenShema = z.object({
  userId: z.string().describe('Admin Only - Query token for provided user'),
  token: z.string().nonempty('Token is required'),
  provider: z.enum(PushTokenProvider),
  deviceName: z.string().optional(),
});

export const QueryPushTokenSchema = PushTokenShema.omit({
  deviceName: true,
  token: true,
})
  .extend(QueryBuilderSchema.shape)
  .extend({
    //   search: z.string().optional(),
    includeVoided: z
      .stringbool({
        truthy: ['true', '1'],
        falsy: ['false', '0'],
      })
      .optional()
      .default(false),
  })
  .partial();
export class QueryPushTokenDto extends createZodDto(QueryPushTokenSchema) {}
export class SetPushTokenDto extends createZodDto(
  PushTokenShema.omit({ userId: true }),
) {}

export class GetPushTokenResponseDto implements UserPushToken {
  @ApiProperty()
  userId: string;
  @ApiProperty()
  id: string;
  @ApiProperty()
  token: string;
  @ApiProperty({ enum: PushTokenProvider })
  provider: string;
  @ApiProperty()
  deviceName: string;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  @ApiProperty()
  voided: boolean;
}
export class QueryPushTokenResponseDto {
  @ApiProperty({ isArray: true, type: GetPushTokenResponseDto })
  results: GetPushTokenResponseDto[];

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
