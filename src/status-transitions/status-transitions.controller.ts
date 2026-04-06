import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CustomRepresentationQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import {
  GetStatusTransitionResponseDto,
  QueryStatusTransitionsDto,
  QueryStatusTransitionsResponseDto,
} from './status-transitions.transitions.dto';
import { StatusTransitionService } from './status-transition.service';
import { RequireSystemPermission } from 'src/auth/auth.decorators';

@Controller('status-transitions')
export class StatusTransitionsController {
  constructor(
    private readonly statusTransitionService: StatusTransitionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Query status transitions' })
  @ApiOkResponse({ type: QueryStatusTransitionsResponseDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ statusTransition: ['view'] })
  findAll(
    @Query() query: QueryStatusTransitionsDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.statusTransitionService.findAll(query, originalUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get status transition by id' })
  @ApiOkResponse({ type: GetStatusTransitionResponseDto })
  @ApiErrorsResponse({ notFound: true })
  @RequireSystemPermission({ statusTransition: ['view'] })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.statusTransitionService.findOne(id, query);
  }
}
