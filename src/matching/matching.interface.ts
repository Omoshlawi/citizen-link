import { Document } from '../../generated/prisma/client';

export interface FindMatchesOptions {
  limit?: number;
  skip?: number;
  similarityThreshold?: number;
  includeTotal?: boolean; // Whether to count total matches (adds extra query)
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CandidateMatch {
  documentId: string;
  caseId: string;
  typeId: string;
  fullName: string | null;
  documentNumber: string | null;
  serialNumber: string | null;
  dateOfBirth: Date | null;
  placeOfBirth: string | null;
  similarity: number;
}

export interface VerifyMatchesOptions {
  minVerificationScore?: number;
}
