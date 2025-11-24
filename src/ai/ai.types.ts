import { Provider, Type } from '@nestjs/common';

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
