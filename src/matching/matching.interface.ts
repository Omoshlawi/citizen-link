import { z } from 'zod';
import {
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
  FoundDocumentCase,
  LostDocumentCase,
  MatchTrigger,
} from '../../generated/prisma/client';
import { AiMatchVerificationSchema, FieldAnalysisSchema } from './matching.dto';
import { Provider, Type } from '@nestjs/common';

export interface FindMatchesOptions {
  similarityThreshold?: number;
  limit?: number; // TopN matches
  exactMatchThreshold?: number; // for Layer 2
  aiMatchThreshold?: number; // for Layer 3
  minimumFinalScore?: number; // for final filter
  weights?: {
    vector: number;
    exact: number;
    ai: number;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface VerifyMatchesOptions {
  minVerificationScore?: number;
}

export interface CandidateMatch {
  documentId: string;
  caseId: string;
  typeId: string;
  fullName?: string | null;
  surname?: string | null;
  documentNumber?: string | null;
  serialNumber?: string | null;
  dateOfBirth?: Date | null;
  placeOfBirth?: string | null;
  addressCountry?: string | null;
  similarity: number; // Layer 1 vector score
}

export interface MatchedField {
  field: string;
  triggerValue?: string | null; // value from the document that triggered the match
  candidateValue?: string | null; // value from the candidate document
  matched: boolean;
  score: number;
}

// Computed after parsing — not from AI
export interface ComputedMatchScores {
  overallScore: number; // deterministic from fieldAnalysis
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'; // derived from overallScore
  aiScore: number; // used in final score formula
}

export type FieldAnalysis = z.infer<typeof FieldAnalysisSchema>;
export type AiMatchVerification = z.infer<typeof AiMatchVerificationSchema>;

export interface ExactMatchResult {
  triggerDoc: Document & { type: DocumentType }; // the document that triggered — lost or found
  candidateDoc: CandidateMatch; // the opposite side candidate
  exactScore: number;
  matchedFields: MatchedField[];
}

export interface AiVerificationResult extends ExactMatchResult {
  verification: AiMatchVerification;
  scores: ComputedMatchScores;
  aiInteractionId: string;
  lostDocCase: DocumentCase & {
    document: Document & {
      type: DocumentType;
      additionalFields: DocumentField[];
    };
    lostDocumentCase?: LostDocumentCase | null;
    foundDocumentCase?: FoundDocumentCase | null;
  };
  foundDocCase: DocumentCase & {
    document: Document & {
      type: DocumentType;
      additionalFields: DocumentField[];
    };
    lostDocumentCase?: LostDocumentCase | null;
    foundDocumentCase?: FoundDocumentCase | null;
  };
}

export interface VectorSearchParams {
  embeddingVector: number[];
  typeId: string;
  excludeDocumentId: string;
  excludeUserId: string;
  similarityThreshold: number;
  topN: number;
}

export type MatchingOptions = {
  weights: {
    vector: number;
    exact: number;
    ai: number;
  };
  vectorSimilarityThreshold: number;
  topNCandidates: number;
  exactMatchThreshold: number;
  aiMatchThreshold: number;
  minimumFinalScore: number;
  autoConfirmThreshold: number;
  maxSecurityQuestions: number;
};

export type MatchingModuleAsyncOptions = {
  global?: boolean;
  useFactory?: (...args: any[]) => Promise<MatchingOptions> | MatchingOptions;
  useClass?: Type<MatchingOptions>;
  useExisting?: Type<MatchingOptions>;
  useValue?: MatchingOptions;
  inject?: Type<any>[];
  imports?: Type<any>[];
  providers?: Array<Provider>;
};

export interface DocumentMatchingJobData {
  documentId: string;
  trigger: MatchTrigger;
  userId: string;
}
