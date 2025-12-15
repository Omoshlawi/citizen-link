import { Type } from '@nestjs/common';
import {
  PrismaClientOptions,
  Subset,
} from '../../generated/prisma/internal/prismaNamespace';

export type PrismaAsyncOptions = {
  useFactory: (
    ...args: any[]
  ) =>
    | Promise<Subset<PrismaClientOptions, PrismaClientOptions>>
    | Subset<PrismaClientOptions, PrismaClientOptions>;
  inject: Type<any>[];
  global: boolean;
};
