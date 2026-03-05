import { UserSession } from '../auth/auth.types';
import { AIInteraction } from '../../generated/prisma/client';
import {
  AdditionalFieldSchema,
  ExtractionWarningSchema,
  TextExtractionOutputSchema,
} from './extraction.dto';
import { z } from 'zod';
import { VisionExtractionOutputSchema } from '../vision/vision.dto';

export interface AsyncError {
  message: string;
  error?: any;
}

export interface AsyncState<
  TData = any,
  TError extends AsyncError = AsyncError,
> {
  isLoading: boolean;
  error?: TError;
  data?: TData;
}
export interface ExtractionAiProgressEvent {
  key: 'VISION_EXTRACTION' | 'TEXT_EXTRACTION';
  state: AsyncState<
    Omit<AIInteraction, 'parsedResponse' | 'parseError'> & {
      parsedResponse: TextExtractionOutput | VisionExtractionOutput | null;
      parseError: AsyncError | null;
    }
  >;
}

export type ExtractionProgressEvent =
  | ExtractionValidationEvent
  | ExtractionAiProgressEvent;
export type ExtractionStep = ExtractionProgressEvent['key'];
export type ExtractionOptions = {
  onPublishProgressEvent?: (data: ExtractionProgressEvent) => void;
  skipSecurityQuestion?: boolean;
};
export type ImageExtractionInput = {
  extractionId: string;
  files: Array<{ buffer: Buffer; mimeType: string }>;
  user?: UserSession['user'];
  options?: ExtractionOptions;
};

export type ExtractInformationInput = ImageExtractionInput;

export interface ExtractionValidationEvent {
  key: 'IMAGE_VALIDATION' | 'DOCUMENT_TYPE_VALIDATION';
  state: AsyncState<string>;
}
export type AdditionalField = z.infer<typeof AdditionalFieldSchema>;
export type ExtractionWarning = z.infer<typeof ExtractionWarningSchema>;
export type VisionExtractionOutput = z.infer<
  typeof VisionExtractionOutputSchema
>;
export type TextExtractionOutput = z.infer<typeof TextExtractionOutputSchema>;
