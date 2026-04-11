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
import { ApiErrorsResponse } from '../../app.decorators';
import { RequireSystemPermission } from '../../auth/auth.decorators';
import { UserSession } from '../../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../../common/query-builder';
import {
  CreateStaffStationOperationDto,
  GetMyStationsResponseDto,
  GetStaffStationOperationResponseDto,
  GetStaffStationOperationsListDto,
  QueryStaffStationOperationsDto,
} from '../document-custody.dto';
import { StaffStationOperationService } from './staff-station-operation.service';

@Controller('staff-station-operations')
export class StaffStationOperationController {
  constructor(private readonly service: StaffStationOperationService) {}

  @Get('mine')
  @ApiOperation({
    summary: 'Get stations the current user is assigned to (deduplicated)',
  })
  @ApiOkResponse({ type: GetMyStationsResponseDto })
  @ApiErrorsResponse()
  findMyStations(@Session() { user }: UserSession) {
    return this.service.findMyStations(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List staff station operation grants' })
  @ApiOkResponse({ type: GetStaffStationOperationsListDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ staffStationOperation: ['view'] })
  findAll(
    @Query() query: QueryStaffStationOperationsDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.service.findAll(query, originalUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff station operation grant by ID' })
  @ApiOkResponse({ type: GetStaffStationOperationResponseDto })
  @ApiErrorsResponse({ notFound: true })
  @RequireSystemPermission({ staffStationOperation: ['view'] })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.findOne(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Grant one or more staff station operations' })
  @ApiOkResponse({ type: GetStaffStationOperationResponseDto, isArray: true })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ staffStationOperation: ['manage'] })
  grant(
    @Body() dto: CreateStaffStationOperationDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.grant(dto, user.id, query);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke or purge a staff station operation grant' })
  @ApiOkResponse({ type: GetStaffStationOperationResponseDto })
  @ApiErrorsResponse({ notFound: true })
  @RequireSystemPermission({ staffStationOperation: ['manage'] })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() { user }: UserSession,
    @Query() query: DeleteQueryDto,
  ) {
    return this.service.revoke(id, user.id, query);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'Restore a revoked staff station operation grant' })
  @ApiOkResponse({ type: GetStaffStationOperationResponseDto })
  @ApiErrorsResponse({ notFound: true })
  @RequireSystemPermission({ staffStationOperation: ['manage'] })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.restore(id, query);
  }
}
