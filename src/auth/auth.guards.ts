import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { Request } from 'express';
import { RequireSystemPermission } from './auth.decorators';
import { BetterAuthWithPlugins } from './auth.types';

@Injectable()
export class RequireSystemPermissionsGuard implements CanActivate {
  private logger = new Logger(RequireSystemPermissionsGuard.name);
  constructor(
    private readonly authService: AuthService<BetterAuthWithPlugins>,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.get(
      RequireSystemPermission,
      context.getHandler(),
    );
    if (!permissions || Object.keys(permissions).length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const { success } = await this.authService.api.userHasPermission({
      headers: fromNodeHeaders(request.headers),
      body: {
        permissions,
      },
    });
    if (!success) {
      this.logger.warn(
        `Access denied. Missing permissions: ${JSON.stringify(permissions)}`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
    return true;
  }
}
