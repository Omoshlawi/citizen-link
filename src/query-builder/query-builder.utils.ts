/* eslint-disable @typescript-eslint/no-unused-vars */
import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).nonnegative().optional(), // TODO MOVE TO CONFIG CLASS PAGINATION
  limit: z.coerce.number().nonnegative().optional(), // TODO Same here
});

export const OrderQuerySchema = z.object({
  orderBy: z
    .string()
    .regex(/^-?[a-zA-Z_][a-zA-Z0-9_.]*(?:,-?[a-zA-Z_][a-zA-Z0-9_.]*)*$/)
    .optional(), // TODO Add regex for validating order by
});

export const CustomRepresentationQuerySchema = z.object({
  v: z
    .string()
    .optional()
    .refine(validateRepString, { error: 'Invalid custom representation' }), // TODO Add regex validator
});

export const SortAndRepresentationSchema = z.object({
  ...OrderQuerySchema.shape,
  ...CustomRepresentationQuerySchema.shape,
});

export const QueryBuilderSchema = z.object({
  ...PaginationQuerySchema.shape,
  ...OrderQuerySchema.shape,
  ...CustomRepresentationQuerySchema.shape,
});

export const DeleteQuerySchema = CustomRepresentationQuerySchema.extend({
  purge: z
    .stringbool({ truthy: ['true', '1'], falsy: ['false', '0'] })
    .optional()
    .default(false),
});

export function hasBalancedParentheses(str: string): boolean {
  let count = 0;
  for (const char of str) {
    if (char === '(') count++;
    if (char === ')') count--;
    if (count < 0) return false;
  }
  return count === 0;
}
// TODO Properly refine the validations
export const REP_STRING_REGEX_COMPREHENSIVE =
  /^[a-zA-Z_][a-zA-Z0-9_]*:(?:include|omit|select)\([^)]+\)$/;
export function validateRepString(repString: string): boolean {
  // TODO: Implement proper validation
  return true;
}

export class PaginationQueryDto extends createZodDto(PaginationQuerySchema) {}
export class OrderQueryDto extends createZodDto(OrderQuerySchema) {}
export class CustomRepresentationQueryDto extends createZodDto(
  CustomRepresentationQuerySchema,
) {}
export class SortAndRepresentationDto extends createZodDto(
  SortAndRepresentationSchema,
) {}
export class QueryBuilderDto extends createZodDto(QueryBuilderSchema) {}
export class DeleteQueryDto extends createZodDto(DeleteQuerySchema) {}
