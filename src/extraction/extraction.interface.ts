import { UserSession } from '../auth/auth.types';
import { AIInteraction } from '../../generated/prisma/client';

export interface AsyncState<TData = any, TError extends Error = Error> {
  isLoading: boolean;
  error?: TError;
  data?: TData;
}
interface _ProgressEvent {
  key:
    | 'IMAGE_ANALYSIS'
    | 'DATA_EXTRACTION'
    | 'CONFIDENCE_SCORE'
    | 'SECURITY_QUESTIONS';
  state: AsyncState<AIInteraction>;
}

export type ProgressEvent = ImageValidationEvent | _ProgressEvent;
export type ExtractionStep = ProgressEvent['key'];
export type ExtractionOptions = {
  onPublishProgressEvent?: (data: ProgressEvent) => void;
  skipSecurityQuestion?: boolean;
};
export type ImageExtractionInput = {
  extractionId: string;
  files: Array<{ buffer: Buffer; mimeType: string }>;
  user?: UserSession['user'];
  options?: ExtractionOptions;
};

export type ExtractInformationInput = ImageExtractionInput;

export interface ImageValidationEvent {
  key: 'IMAGE_VALIDATION';
  state: AsyncState<string>;
}
