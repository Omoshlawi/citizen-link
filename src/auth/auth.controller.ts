import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous, AuthService } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../prisma/prisma.service';
import type { BetterAuthWithPlugins } from './auth.types';
import { adminPluginRoles } from './auth.acl';

@Controller('/extended/auth')
export class AuthExtendedController {
  constructor(
    private readonly authService: AuthService<BetterAuthWithPlugins>,
    private readonly prismaService: PrismaService,
  ) {}

  @Get('roles')
  @AllowAnonymous()
  getRoles() {
    const roles = Object.entries(adminPluginRoles).map(([role, definition]) => {
      const label = this.toLabel(role);
      const roleDefinition = definition as {
        statements?: Record<string, string[]>;
      };
      const statements = roleDefinition.statements ?? {};
      const permissions = Object.entries(statements).flatMap(
        ([resource, actions]) =>
          actions.map((action) => ({
            resource,
            resourceName: this.toLabel(resource),
            action,
            actionName: this.toLabel(action),
          })),
      );

      return {
        role,
        name: label,
        permissions,
      };
    });
    return {
      results: roles,
      totalCount: roles.length,
    };
  }

  private toLabel(value: string) {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
