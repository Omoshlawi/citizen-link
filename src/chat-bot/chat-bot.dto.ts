import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const ChatSchema = z.object({
  query: z.string().min(1, 'Message cannot be empty'),
});

export class ChatDto extends createZodDto(ChatSchema) {}

export class ChatResponseDto extends ChatDto {}
