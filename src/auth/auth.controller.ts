import { Controller } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma/prisma.service';
import type { BetterAuthWithPlugins } from './auth.types';

@Controller('/extended/auth')
export class AuthExtendedController {
  constructor(
    private readonly authService: AuthService<BetterAuthWithPlugins>,
    private readonly prismaService: PrismaService,
  ) {}
}
