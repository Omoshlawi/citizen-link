import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { QueryBuilderSchema } from '../common/query-builder/query-builder.utils';
import { InvoiceStatus } from '../../generated/prisma/enums';

export const InvoiceSchema = z.object({ claimId: z.uuid() });
export const QueryInvoiceSchema = z.object({
  ...QueryBuilderSchema.shape,
  claimId: z.uuid().optional(),
  userId: z.string().optional().describe('Admin Only - Filter by user ID'),
  invoiceNumber: z.string().optional(),
  claimNumber: z.string().optional(),
  status: z.enum(InvoiceStatus).optional(),
});

export class CreateInvoiceDto extends createZodDto(InvoiceSchema) {}
export class QueryInvoiceDto extends createZodDto(QueryInvoiceSchema) {}
