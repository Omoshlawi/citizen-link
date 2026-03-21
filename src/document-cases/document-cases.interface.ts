import { MatchTrigger } from '../../generated/prisma/enums';

export interface DocumentEmbeddingJob {
  documentId: string;
  trigger: MatchTrigger;
  userId: string;
}
