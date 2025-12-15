import { Provider, Type } from '@nestjs/common';
import { DocumentCategory } from '../../generated/prisma/enums';

export type AIOptions = {
  geminiApiKey: string;
  model:
    | 'gemini-2.5-flash'
    | 'gemini-2.5-pro'
    | 'gemini-2.5-pro-exp'
    | 'gemini-2.0-flash-001';
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
export type ImageExtractionInput = {
  files: Array<{ buffer: Buffer; mimeType: string }>;
  userId?: string;
};

export type ExtractInformationInput = ImageExtractionInput;
