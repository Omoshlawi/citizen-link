import { Provider, Type } from '@nestjs/common';
import {
  AIInteractionType,
  DocumentCategory,
} from '../../generated/prisma/enums';
import { ChatModel } from 'openai/resources/chat/chat';
import OpenAI from 'openai';
import { AIInteraction } from 'generated/prisma/client';

export type AIOptions = {
  apiKey: string;
  baseURL?: string; // For OpenAI-compatible APIs (e.g., DeepSeek, local proxies)
  model: ChatModel; // Flexible model name - can be any OpenAI-compatible model
};

export type AiModuleOptions = {
  global?: boolean;
  useFactory?: (...args: any[]) => Promise<AIOptions> | AIOptions;
  useClass?: Type<AIOptions>;
  useExisting?: Type<AIOptions>;
  useValue?: AIOptions;
  inject?: Type<any>[];
  imports?: Type<any>[];
  providers?: Array<Provider>;
};

export interface Part {
  text?: string;
  image?: {
    url: string;
  };
}

export type GenerateContentConfig = Pick<
  OpenAI.Chat.Completions.ChatCompletionCreateParams,
  'temperature' | 'max_completion_tokens'
>;

export interface GenerateContentResponse {
  text?: string;
  modelVersion?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}
export interface GenerateParsedContentResponse<T> {
  data?: T;
  modelVersion?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

// ============= TYPE DEFINITIONS =============

export interface DocumentTypeConfig {
  name: string;
  category: DocumentCategory;
  expectedFields: string[];
  verificationStrategy: {
    strictFields: string[];
    flexibleFields: string[];
  };
}

export interface ImageInput {
  url: string;
  type?: string; // 'front', 'back', 'full'
}

export interface ExtractionResult {
  extractedData: Record<string, any>;
  confidence: Record<string, number>;
  aiAnalysis: {
    imageQuality: number;
    readability: number;
    tamperingDetected: boolean;
    warnings: string[];
  };
}

export interface MatchResult {
  matchScore: number;
  aiAnalysis: {
    reasoning: string;
    fieldComparison: Record<
      string,
      {
        match: boolean;
        confidence: number;
        reasoning: string;
      }
    >;
    riskFactors: Record<string, boolean>;
    alternativeMatches?: Array<{
      foundDocumentCaseId: string;
      matchScore: number;
      reasoning: string;
    }>;
  };
}

export interface VerificationResult {
  passed: boolean;
  overallVerdict:
    | 'STRONG_MATCH'
    | 'LIKELY_MATCH'
    | 'UNCERTAIN'
    | 'NO_MATCH'
    | 'INSUFFICIENT_DATA';
  confidenceScore: number;
  reasoning: string;
  aiAnalysis: Record<
    string,
    {
      expected: string;
      provided: string;
      match: boolean;
      confidence: number;
      reasoning: string;
    }
  >;
  flexibilityApplied: string[];
}

export type OcrExtractionInput = {
  source: 'ocr';
  extractedText: string;
  userId?: string;
};

export type ExtractionOptions = {
  onBeforeInteractionHook?:
    | ((type: AIInteractionType) => void)
    | ((type: AIInteractionType) => Promise<void>);
  onAfterInteractionHook?:
    | ((type: AIInteractionType, interaction: AIInteraction) => void)
    | ((type: AIInteractionType, interaction: AIInteraction) => Promise<void>);
};
export type ImageExtractionInput = {
  files: Array<{ buffer: Buffer; mimeType: string }>;
  userId?: string;
  options?: ExtractionOptions;
};

export type ExtractInformationInput = ImageExtractionInput;
