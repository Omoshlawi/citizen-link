import { Injectable } from '@nestjs/common';
import { Hook } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma/prisma.service';

@Hook()
@Injectable()
export class AuthHookHook {
  constructor(private readonly prismaService: PrismaService) {}
}
