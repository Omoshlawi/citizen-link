import { Provider, Type } from '@nestjs/common';

export type EmbeddingOptions = {
  embeddingModel: string;
  embeddingBaseUrl: string;
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
