import { ApiProperty } from '@nestjs/swagger';
import { EntityPrefix } from './human-id.constants';
import z from 'zod';
import { createZodDto } from 'nestjs-zod';

export const DecordIdSchema = z.object({
  id: z.string(),
});

export const GenerateIdSchema = z.object({
  prefix: z.enum(EntityPrefix),
});

export class GenerateIdResponseDto {
  @ApiProperty()
  id: string;
}

export class GenerateIdDto extends createZodDto(GenerateIdSchema) {}
export class DecodeIdDto extends createZodDto(DecordIdSchema) {}

export class SequenceResponseDto {
  @ApiProperty({
    enum: EntityPrefix,
  })
  prefix: EntityPrefix;

  @ApiProperty()
  lastSequence: number;

  @ApiProperty()
  paddedSequence: string;

  @ApiProperty()
  lastUsedAt: Date;

  @ApiProperty()
  nextWillBe: string;
}

export class SequencesResponseDto {
  @ApiProperty({
    type: SequenceResponseDto,
    isArray: true,
  })
  results: SequenceResponseDto[];
}

export class DecodedIdResponseDto {
  @ApiProperty()
  raw: string;

  @ApiProperty({
    enum: EntityPrefix,
  })
  prefix: EntityPrefix;

  @ApiProperty()
  sequence: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  createdAtFormatted: string;
}
