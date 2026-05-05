import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import { RequireSystemPermission } from '../auth/auth.decorators';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import {
  CreateStaffOperationScopeDto,
  GetStaffOperationScoperResponseDto,
  GetStaffOperationsScoperListDto,
  QueryStaffOperationsScopeDto,
} from './staff-operation-scope.dto';
import { StaffOperationScopeService } from './staff-operation-scope.service';

@Controller('operation-scope')
export class StaffOperationScopeController {
  constructor(private readonly service: StaffOperationScopeService) {}

  @Get()
  @ApiOperation({ summary: 'List staff operation scope' })
  @ApiOkResponse({ type: GetStaffOperationsScoperListDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryStaffOperationsScopeDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.service.findAll(query, originalUrl, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff operation scope by ID' })
  @ApiOkResponse({ type: GetStaffOperationScoperResponseDto })
  @ApiErrorsResponse({ notFound: true })
  @RequireSystemPermission({ staffOperationScope: ['view'] })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.findOne(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Grant one or more staff station operations' })
  @ApiOkResponse({ type: GetStaffOperationScoperResponseDto, isArray: true })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ staffOperationScope: ['manage'] })
  grant(
    @Body() dto: CreateStaffOperationScopeDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.grant(dto, user.id, query);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke or purge a staff station operation grant' })
  @ApiOkResponse({ type: GetStaffOperationScoperResponseDto })
  @ApiErrorsResponse({ notFound: true })
  @RequireSystemPermission({ staffOperationScope: ['manage'] })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() { user }: UserSession,
    @Query() query: DeleteQueryDto,
  ) {
    return this.service.revoke(id, user.id, query);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'Restore a revoked staff station operation grant' })
  @ApiOkResponse({ type: GetStaffOperationScoperResponseDto })
  @ApiErrorsResponse({ notFound: true })
  @RequireSystemPermission({ staffOperationScope: ['manage'] })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.restore(id, query);
  }
}
