import { GenerateContentConfig } from './ai.types';
// import { zodResponseFormat } from 'openai/helpers/zod';
// import {
//   ConfidenceSchema,
//   DataExtractionSchema,
//   ImageAnalysisSchema,
// } from './ocr.dto';

export const AI_OPTIONS_TOKEN = 'AI_OPTIONS';
export const AI_DATA_EXTRACT_CONFIG: GenerateContentConfig = {
  temperature: 0.1,
  max_completion_tokens: 2048,
  // response_format: zodResponseFormat(DataExtractionSchema, 'dataExtractionDto'),
};

export const AI_CONFIDENCE_CONFIG: GenerateContentConfig = {
  temperature: 0.1,
  max_completion_tokens: 2048,
  // response_format: zodResponseFormat(ConfidenceSchema, 'confidenceDto'),
};

export const AI_IMAGE_ANALYSIS_CONFIG: GenerateContentConfig = {
  temperature: 0.1,
  max_completion_tokens: 2048,
  // response_format: zodResponseFormat(ImageAnalysisSchema, 'imageAnalysisDto'),
};
