import z from 'zod';
import {
  SortAndRepresentationSchema,
  PaginationQuerySchema,
  CustomRepresentationQuerySchema,
  OrderQuerySchema,
} from './query-builder.utils';

export interface PaginationControls {
  next: string | null;
  prev: string | null;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

export interface PaginatedResult<T> {
  results: T[];
  pagination: PaginationControls;
}

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type SortAndRepresentionQuery = z.infer<
  typeof SortAndRepresentationSchema
>;
export type CustomRepresentationQuery = z.infer<
  typeof CustomRepresentationQuerySchema
>;
export type SortQuery = z.infer<typeof OrderQuerySchema>;

export type FunctionFirstArgument<T> = T extends (...args: any[]) => any
  ? Parameters<T>[0]
  : never;
