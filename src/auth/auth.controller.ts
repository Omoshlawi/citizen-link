/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { AllowAnonymous, AuthService } from '@thallesp/nestjs-better-auth';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { UserSession, BetterAuthWithPlugins } from './auth.types';
import {
  CreateUserExtendedDto,
  CreatedUserResponseDto,
  GetRolesResponseDto,
  SessionResponseDto,
  UpdateSessionDto,
} from './auth.dto';
import { RequireSystemPermission } from './auth.decorators';
import { RolesService } from '../roles/roles.service';

@Controller('/extended/auth')
export class AuthExtendedController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
    private readonly rolesService: RolesService,
  ) {}

  // Users

  @Post('users')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create user with optional username and phone number',
    description:
      'Extends Better Auth admin createUser: creates the account via Better Auth, then sets username and phoneNumber directly on the record.',
  })
  @ApiCreatedResponse({ type: CreatedUserResponseDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ user: ['create'] })
  async createUser(
    @Req() request: Request,
    @Body() dto: CreateUserExtendedDto,
  ): Promise<CreatedUserResponseDto> {
    if (dto.username) {
      const { available } = await this.authService.api.isUsernameAvailable({
        body: { username: dto.username },
      });
      if (!available)
        throw new BadRequestException('User exist with given username');
    }
    if (dto.phoneNumber) {
      const count = await this.prismaService.user.count({
        where: {
          phoneNumber: dto.phoneNumber,
        },
      });
      if (count > 0)
        throw new BadRequestException('User exist with given phone number');
    }

    const { user } = await this.authService.api.createUser({
      body: { ...dto, role: dto.role as any },
    });

    const updated = await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        ...(dto.username ? { username: dto.username } : {}),
        ...(dto.phoneNumber ? { phoneNumber: dto.phoneNumber } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        phoneNumber: true,
        createdAt: true,
      },
    });

    return updated;
  }

  // Session

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
  async getRoles() {
    const { results } = await this.rolesService.listRoles({
      includeVoided: false,
    });
    const mapped = results.map((roleRecord) => {
      const permissions = roleRecord.permissions.map((perm) => ({
        resource: perm.resource.slug,
        resourceName: perm.resource.name,
        action: perm.resourceAction.slug,
        actionName: perm.resourceAction.name,
      }));
      return { role: roleRecord.slug, name: roleRecord.name, permissions };
    });
    return { results: mapped, totalCount: mapped.length };
  }
}
