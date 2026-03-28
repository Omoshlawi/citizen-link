import { MatchTrigger } from '../../generated/prisma/enums';

export interface DocumentEmbeddingJob {
  documentId: string;
  trigger: MatchTrigger;
  userId: string;
}

export type CaseType = 'LOST' | 'FOUND';

/** Shared job shape across all three extraction pipeline queues */
export interface CaseExtractionJob {
  caseId: string;
  documentId: string;
  extractionId: string;
  images: string[];
  userId: string;
  caseType: CaseType;
  caseNumber: string;
}
