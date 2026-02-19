import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Delete,
  Post,
} from '@nestjs/common';
import { TransitionReasonsService } from './status-transitions.reasons.service';
import {
  GetTransitionReasonResponseDto,
  QueryStatusTransitionReasonsDto,
  QueryTransitionReasonsResponseDto,
} from './status-transitions.dto';
import { ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../common/query-builder';

@Controller('status-transitions-reasons')
export class StatusTransitionsReasonsController {
  constructor(
    private readonly transitionReasonsService: TransitionReasonsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all status transition reasons' })
  @ApiOkResponse({ type: QueryTransitionReasonsResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryStatusTransitionReasonsDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.transitionReasonsService.findAll(query, originalUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get status transition reason by id' })
  @ApiOkResponse({ type: GetTransitionReasonResponseDto })
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.transitionReasonsService.findOne(id, query);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete status transition reason' })
  @ApiOkResponse({ type: GetTransitionReasonResponseDto })
  @ApiErrorsResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
  ) {
    return this.transitionReasonsService.remove(id, query);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore status transition reason' })
  @ApiOkResponse({ type: GetTransitionReasonResponseDto })
  @ApiErrorsResponse()
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.transitionReasonsService.restore(id, query);
  }
}
