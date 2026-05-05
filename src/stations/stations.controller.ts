import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  ParseUUIDPipe,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import { OptionalAuth, Session } from '@thallesp/nestjs-better-auth';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import { UserSession } from '../auth/auth.types';
import { PickupStationsService } from './stations.service';
import {
  CreatePickupStationDto,
  GetPickupStationResponseDto,
  GetUserAssignedStationsDto,
  QueryPickupStationDto,
  QueryPickupStationResponseDto,
  UpdatePickupStationDto,
} from './station.dto';
import { RequireSystemPermission } from '../auth/auth.decorators';
@Controller('stations')
export class PickupStationsController {
  constructor(private readonly pickupStationService: PickupStationsService) {}

  @Get('/')
  @ApiOperation({ summary: 'Query Pickup stations' })
  @ApiOkResponse({ type: QueryPickupStationResponseDto })
  @ApiErrorsResponse()
  @OptionalAuth()
  queryPickupStations(
    @Query() query: QueryPickupStationDto,
    @OriginalUrl() originalUrl: string,
    @Session() session?: UserSession,
  ) {
    return this.pickupStationService.getAll(query, originalUrl, session?.user);
  }

  @Get('/assigned')
  @ApiOperation({ summary: 'Get stations that user has grants on' })
  @ApiOkResponse({ type: QueryPickupStationResponseDto })
  @ApiErrorsResponse()
  getAssignedStations(
    @Query() query: GetUserAssignedStationsDto,
    @Session() { user }: UserSession,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.pickupStationService.getAssignedStations(
      query,
      user,
      originalUrl,
    );
  }
  @Get('/:id')
  @ApiOperation({ summary: 'Get Pickup stations' })
  @ApiOkResponse({ type: GetPickupStationResponseDto })
  @ApiErrorsResponse()
  @OptionalAuth()
  getPickupStation(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() session?: UserSession,
  ) {
    return this.pickupStationService.getById(id, query, session?.user);
  }
  @Post('/')
  @ApiOperation({ summary: 'Create Pickup station' })
  @ApiCreatedResponse({ type: GetPickupStationResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ station: ['create'] })
  createPickupStation(
    @Body() createAddressDto: CreatePickupStationDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.pickupStationService.create(createAddressDto, user.id, query);
  }
  @Patch('/:id')
  @ApiOperation({ summary: 'Update Pickup station' })
  @ApiOkResponse({ type: GetPickupStationResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ station: ['update'] })
  updatePickupStation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAddressDto: UpdatePickupStationDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.pickupStationService.update(
      id,
      updateAddressDto,
      query,
      user.id,
    );
  }
  @Delete('/:id')
  @ApiOperation({ summary: 'Delete Pickuo station' })
  @ApiOkResponse({ type: GetPickupStationResponseDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ station: ['delete'] })
  deletePickupStation(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.pickupStationService.delete(id, query, user.id);
  }
  @Post('/:id/restore')
  @ApiOperation({ summary: 'Restore Pickup station' })
  @ApiOkResponse({ type: GetPickupStationResponseDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ station: ['restore'] })
  restorePickupStation(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.pickupStationService.restore(id, query, user.id);
  }
}
