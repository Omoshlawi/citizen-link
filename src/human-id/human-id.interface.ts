export interface DecodedHumanId {
  prefix: string;
  createdAt: Date;
  sequence: number;
  raw: string;
}

export interface ParsedHumanId {
  prefix: string;
  createdAt: Date;
  sequence: number;
}

export interface SequenceInfo {
  prefix: string;
  lastSequence: number;
  paddedSequence: string;
  lastUsedAt: Date;
  nextWillBe: string;
}

export interface HumanIdModuleOptions {
  paddingLength?: number;
}

export interface HumanIdModuleAsyncOptions {
  global?: boolean;
  useFactory: (
    ...args: any[]
  ) => Promise<HumanIdModuleOptions> | HumanIdModuleOptions;
  inject?: any[];
  imports?: any[];
}
