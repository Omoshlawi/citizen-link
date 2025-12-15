import { DynamicModule, Module } from '@nestjs/common';
import { PRISMA_CONFIG_TOKEN } from './prisma.contants';
import { PrismaService } from './prisma.service';
import { PrismaAsyncOptions } from './prisma.types';
@Module({})
export class PrismaModule {
  static forRootAsync(options: PrismaAsyncOptions): DynamicModule {
    return {
      module: PrismaModule,
      global: options.global,
      providers: [
        {
          provide: PRISMA_CONFIG_TOKEN,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        PrismaService,
      ],
      exports: [PrismaService],
    };
  }
}
