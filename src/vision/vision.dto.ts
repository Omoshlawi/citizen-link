import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const VisionExtractionOutputSchema = z.object({
  meta: z.object({
    sourceType: z.enum(['image', 'pdf']).default('image'),
    pageCount: z.number(),
    languageHints: z.array(z.string()).default([]),
    engine: z.literal('vision-llm').default('vision-llm'),
  }),
  pages: z.array(
    z.object({
      pageNumber: z.number(),
      width: z.number(),
      height: z.number(),
      blocks: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          text: z.string(),
          tags: z.array(z.string()).default([]),
          confidence: z.number(),
          bbox: z.array(z.number()),
        }),
      ),
    }),
  ),
  fullText: z.string(),
  averageConfidence: z.number(),
});

export class VisionExtractionOutputDto extends createZodDto(
  VisionExtractionOutputSchema,
) {}
