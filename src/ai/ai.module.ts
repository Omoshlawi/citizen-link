import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AI_OPTIONS_TOKEN } from './ai.contants';
import { AiModuleOptions } from './ai.types';
import { AiService } from './ai.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { EmbeddingConfig } from 'src/embedding/embedding.config';

@Module({})
export class AiModule {
  static registerAsync(options: AiModuleOptions = {}): DynamicModule {
    return {
      global: options.global,
      module: AiModule,
      controllers: [AiController],
      providers: [
        ...(options.providers || []),
        this.createAsyncProvider(options),
        AiService,
      ],
      imports: [
        ...(options.imports ?? []),
        EmbeddingModule.registerAsync({
          useFactory: (config: EmbeddingConfig) => {
            return {
              model: config.model,
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              isOpenAi: config.isOpenAi,
            };
          },
          inject: [EmbeddingConfig],
        }),
      ],
      exports: [AiService, EmbeddingModule],
    };
  }

  private static createAsyncProvider(options: AiModuleOptions): Provider {
    if (options.useFactory) {
      return {
        provide: AI_OPTIONS_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject,
      };
    }
    if (options.useClass) {
      return {
        provide: AI_OPTIONS_TOKEN,
        useClass: options.useClass,
      };
    }
    if (options.useExisting) {
      return {
        provide: AI_OPTIONS_TOKEN,
        useExisting: options.useExisting,
      };
    }
    if (options.useValue) {
      return {
        provide: AI_OPTIONS_TOKEN,
        useValue: options.useValue,
      };
    }
    throw new Error('Invalid options');
  }
}
