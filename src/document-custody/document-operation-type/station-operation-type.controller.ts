import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../../app.decorators';
import { RequireSystemPermission } from '../../auth/auth.decorators';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../../common/query-builder';
import {
  CreateStationOperationTypeDto,
  GetStationOperationTypeResponseDto,
  GetStationOperationTypesListDto,
  QueryStationOperationTypesDto,
  UpdateStationOperationTypeDto,
} from '../document-custody.dto';
import { StationOperationTypeService } from './station-operation-type.service';

@Controller('pickup-stations/:stationId/operation-types')
export class StationOperationTypeController {
  constructor(private readonly service: StationOperationTypeService) {}

  @Get()
  @ApiOperation({ summary: 'List operation types for a station' })
  @ApiOkResponse({ type: GetStationOperationTypesListDto })
  @ApiErrorsResponse()
  findAll(
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Query() query: QueryStationOperationTypesDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.service.findAll(stationId, query, originalUrl);
  }

  @Post()
  @ApiOperation({ summary: 'Enable an operation type at a station' })
  @ApiOkResponse({ type: GetStationOperationTypeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ stationOperationType: ['manage'] })
  create(
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Body() dto: CreateStationOperationTypeDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.create(stationId, dto, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update station operation type (enable/disable)' })
  @ApiOkResponse({ type: GetStationOperationTypeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ stationOperationType: ['manage'] })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStationOperationTypeDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.update(id, dto, query);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Void or purge a station operation type' })
  @ApiOkResponse({ type: GetStationOperationTypeResponseDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ stationOperationType: ['manage'] })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
  ) {
    return this.service.remove(id, query);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'Restore a voided station operation type' })
  @ApiOkResponse({ type: GetStationOperationTypeResponseDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ stationOperationType: ['manage'] })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.restore(id, query);
  }
}
