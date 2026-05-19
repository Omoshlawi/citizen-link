import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import { PaginatedListBase } from '../common/query-builder/pagination.dto';
import { QueryBuilderSchema } from '../common/query-builder';

export const ChatSchema = z.object({
  query: z.string().min(1, 'Message cannot be empty'),
  sessionId: z.uuid().optional(),
});

export class ChatDto extends createZodDto(ChatSchema) {}

export class ChatResponseDto {
  response: string;
  sessionId: string;
}

export const ListSessionsQuerySchema = z.object({
  ...QueryBuilderSchema.shape,
});

export class ListSessionsQueryDto extends createZodDto(ListSessionsQuerySchema) {}

export class ChatMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sessionId: string;

  @ApiProperty({ enum: ['USER', 'ASSISTANT'] })
  role: 'USER' | 'ASSISTANT';

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;
}

export class ChatSessionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  title: string | null;

  @ApiProperty()
  messageCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ListSessionsResponseDto extends PaginatedListBase {
  @ApiProperty({ isArray: true, type: ChatSessionSummaryDto })
  results: ChatSessionSummaryDto[];
}

export class ChatSessionDetailDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  title: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ isArray: true, type: ChatMessageResponseDto })
  messages: ChatMessageResponseDto[];
}
