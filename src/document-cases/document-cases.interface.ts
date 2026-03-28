import { MatchTrigger } from '../../generated/prisma/enums';

export interface DocumentEmbeddingJob {
  documentId: string;
  trigger: MatchTrigger;
  userId: string;
}

export interface LostCaseExtractionJob {
  caseId: string;
  documentId: string;
  extractionId: string;
  images: string[];
  userId: string;
}
