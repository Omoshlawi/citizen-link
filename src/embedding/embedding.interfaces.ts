import { Provider, Type } from '@nestjs/common';

export type EmbeddingOptions = {
  model: string;
  baseUrl: string;
  apiKey: string;
  isAda?: boolean;
};

export type EmbeddingModuleAsyncOptions = {
  global?: boolean;
  useFactory?: (...args: any[]) => Promise<EmbeddingOptions> | EmbeddingOptions;
  useClass?: Type<EmbeddingOptions>;
  useExisting?: Type<EmbeddingOptions>;
  useValue?: EmbeddingOptions;
  inject?: Type<any>[];
  imports?: Type<any>[];
  providers?: Array<Provider>;
};

// Define the shape of the OpenAI Response
export interface OpenAIEmbeddingResponse {
  object: 'list';
  data: {
    object: 'embedding';
    index: number;
    embedding: number[]; // Array of 1536 floats for ada-002
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Define the request body structure
export interface OpenAIEmbeddingRequest {
  model: string;
  input: string | string[];
}
