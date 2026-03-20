import { ExpoClientOptions } from 'expo-server-sdk';

export interface ExpoSdkModuleAsyncOptions {
  global?: boolean;
  useFactory: (
    ...args: any[]
  ) => Promise<Partial<ExpoClientOptions>> | Partial<ExpoClientOptions>;
  inject?: any[];
  imports?: any[];
}
