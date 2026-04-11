import { Body, Controller, Get, HttpCode, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { UserSession } from './auth.types';
import {
  GetRolesResponseDto,
  SessionResponseDto,
  UpdateSessionDto,
} from './auth.dto';
import { adminPluginRoles } from './auth.acl';

@Controller('/extended/auth')
export class AuthExtendedController {
  constructor(private readonly prismaService: PrismaService) {}

  //  Session
  @Patch('session')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Update the current session (e.g. set active station)',
  })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiErrorsResponse()
  async updateSession(
    @Session() { session }: UserSession,
    @Body() dto: UpdateSessionDto,
  ): Promise<SessionResponseDto> {
    const updated = await this.prismaService.session.update({
      where: { id: session.id },
      data: { stationId: dto.stationId ?? null },
      select: { id: true, stationId: true },
    });
    return updated;
  }

  // Roles

  @Get('roles')
  @AllowAnonymous()
  @ApiOperation({ summary: 'List all system roles and their permissions' })
  @ApiOkResponse({ type: GetRolesResponseDto })
  getRoles(): GetRolesResponseDto {
    const results = Object.entries(adminPluginRoles).map(
      ([role, definition]) => {
        const roleDefinition = definition as {
          statements?: Record<string, string[]>;
        };
        const permissions = Object.entries(
          roleDefinition.statements ?? {},
        ).flatMap(([resource, actions]) =>
          actions.map((action) => ({
            resource,
            resourceName: this.toLabel(resource),
            action,
            actionName: this.toLabel(action),
          })),
        );
        return { role, name: this.toLabel(role), permissions };
      },
    );

    return { results, totalCount: results.length };
  }

  // Helpers

  private toLabel(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
