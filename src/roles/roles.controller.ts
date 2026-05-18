import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { RequireSystemPermission } from '../auth/auth.decorators';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import { RolesService } from './roles.service';
import {
  CreateResourceActionDto,
  CreateResourceDto,
  CreateRoleDto,
  EffectivePermissionsResponseDto,
  ListResourcesResponseDto,
  ListRolesResponseDto,
  QueryRolesDto,
  ResourceActionResponseDto,
  ResourceResponseDto,
  RoleResponseDto,
  SetRolePermissionsDto,
  UpdateResourceActionDto,
  UpdateResourceDto,
  UpdateRoleDto,
} from './roles.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ─── Effective permissions (real-time) ────────────────────────────────────

  @Get('my-permissions')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get current user effective permissions (real-time, from DB)',
  })
  @ApiOkResponse({ type: EffectivePermissionsResponseDto })
  @ApiErrorsResponse()
  async getMyPermissions(
    @Session() { user }: UserSession,
  ): Promise<EffectivePermissionsResponseDto> {
    const permissions = await this.rolesService.getEffectivePermissions(
      user.id,
    );
    return { permissions };
  }

  // ─── Resources ─────────────────────────────────────────────────────────────

  @Get('resources')
  @HttpCode(200)
  @ApiOperation({ summary: 'List resources' })
  @ApiOkResponse({ type: ListResourcesResponseDto })
  @ApiErrorsResponse()
  listResources(
    @Query() query: QueryRolesDto,
  ): Promise<ListResourcesResponseDto> {
    return this.rolesService.listResources(query);
  }

  @Post('resources')
  @HttpCode(201)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Create resource' })
  @ApiCreatedResponse({ type: ResourceResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  createResource(@Body() dto: CreateResourceDto) {
    return this.rolesService.createResource(dto);
  }

  @Get('resources/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get resource' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiErrorsResponse()
  findResource(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findResource(id);
  }

  @Patch('resources/:id')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Update resource' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  updateResource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.rolesService.updateResource(id, dto);
  }

  @Delete('resources/:id')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Soft-delete resource (guard: !isBuiltIn)' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiErrorsResponse()
  deleteResource(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.deleteResource(id);
  }

  @Post('resources/:id/restore')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Restore resource' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiErrorsResponse()
  restoreResource(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.restoreResource(id);
  }

  // ─── Resource Actions ──────────────────────────────────────────────────────

  @Get('resources/:id/actions')
  @HttpCode(200)
  @ApiOperation({ summary: 'List actions for a resource' })
  @ApiOkResponse({ type: ResourceActionResponseDto, isArray: true })
  @ApiErrorsResponse()
  listActions(@Param('id', ParseUUIDPipe) resourceId: string) {
    return this.rolesService.listActions(resourceId);
  }

  @Post('resources/:id/actions')
  @HttpCode(201)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Add action to resource' })
  @ApiCreatedResponse({ type: ResourceActionResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  createAction(
    @Param('id', ParseUUIDPipe) resourceId: string,
    @Body() dto: CreateResourceActionDto,
  ) {
    return this.rolesService.createAction(resourceId, dto);
  }

  @Patch('actions/:id')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Update resource action' })
  @ApiOkResponse({ type: ResourceActionResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  updateAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceActionDto,
  ) {
    return this.rolesService.updateAction(id, dto);
  }

  @Delete('actions/:id')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Soft-delete resource action (guard: !isBuiltIn)' })
  @ApiOkResponse({ type: ResourceActionResponseDto })
  @ApiErrorsResponse()
  deleteAction(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.deleteAction(id);
  }

  @Post('actions/:id/restore')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Restore resource action' })
  @ApiOkResponse({ type: ResourceActionResponseDto })
  @ApiErrorsResponse()
  restoreAction(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.restoreAction(id);
  }

  // ─── Roles ─────────────────────────────────────────────────────────────────

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List roles' })
  @ApiOkResponse({ type: ListRolesResponseDto })
  @ApiErrorsResponse()
  listRoles(@Query() query: QueryRolesDto) {
    return this.rolesService.listRoles(query);
  }

  @Post()
  @HttpCode(201)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Create role' })
  @ApiCreatedResponse({ type: RoleResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  createRole(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get role' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiErrorsResponse()
  findRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findRole(id);
  }

  @Patch(':id')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Update role' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Soft-delete role (guard: canDelete)' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiErrorsResponse()
  deleteRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.deleteRole(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({ summary: 'Restore role' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiErrorsResponse()
  restoreRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.restoreRole(id);
  }

  @Put(':id/permissions')
  @HttpCode(200)
  @RequireSystemPermission({ setting: ['manage-system'] })
  @ApiOperation({
    summary: 'Replace all permissions for a role (guard: canEditPermissions)',
  })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  setRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setRolePermissions(id, dto);
  }
}
