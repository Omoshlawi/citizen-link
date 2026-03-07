import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { EmbeddingConfig } from './embedding.config';
import { EmbeddingController } from './embedding.controller';
import { EmbeddingService } from './embedding.service';
import { EmbeddingModuleAsyncOptions } from './embedding.interfaces';
import { EMBEDDING_OPTIONS_TOKEN } from './embedding.constants';

@Module({})
export class EmbeddingModule {
  static registerAsync(options: EmbeddingModuleAsyncOptions): DynamicModule {
    return {
      global: options.global,
      module: EmbeddingModule,
      providers: [
        ...(options.providers || []),
        this.createAsyncProvider(options),
        EmbeddingService,
      ],
      controllers: [EmbeddingController],
      imports: [
        ...(options.imports ?? []),
        HttpModule.registerAsync({
          useFactory: (embeddingConfig: EmbeddingConfig) => ({
            baseURL: embeddingConfig.baseUrl,
          }),
          inject: [EmbeddingConfig],
        }),
      ],
      exports: [EmbeddingService],
    };
  }

  private static createAsyncProvider(
    options: EmbeddingModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: EMBEDDING_OPTIONS_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject,
      };
    }
    if (options.useClass) {
      return {
        provide: EMBEDDING_OPTIONS_TOKEN,
        useClass: options.useClass,
      };
    }
    if (options.useExisting) {
      return {
        provide: EMBEDDING_OPTIONS_TOKEN,
        useExisting: options.useExisting,
      };
    }
    if (options.useValue) {
      return {
        provide: EMBEDDING_OPTIONS_TOKEN,
        useValue: options.useValue,
      };
    }
    throw new Error('Invalid options');
  }
}
