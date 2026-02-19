import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const StatusTransitionSchema = z.object({
  reason: z.uuid(),
  comment: z.string().optional(),
});

export class StatusTransitionDto extends createZodDto(StatusTransitionSchema) {}
