import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import {
  GetHandoverResponseDto,
  QueryHandoverDto,
  QueryHandoverResponseDto,
  ScheduleHandoverDto,
} from './handover.dto';
import { HandoverService } from './handover.service';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';

@Controller('handover')
export class HandoverController {
  constructor(private readonly handoverService: HandoverService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule a handover after claim is verified' })
  @ApiOkResponse({ type: GetHandoverResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  scheduleHandover(
    @Body() dto: ScheduleHandoverDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.handoverService.scheduleHandover(dto, query, user);
  }

  @Get()
  @ApiOperation({ summary: 'Query handovers' })
  @ApiOkResponse({ type: QueryHandoverResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryHandoverDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.handoverService.findAll(query, originalUrl, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get handover by ID' })
  @ApiOkResponse({ type: GetHandoverResponseDto })
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.handoverService.findOne(id, query, user);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a scheduled handover' })
  @ApiOkResponse({ type: GetHandoverResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.handoverService.cancel(id, cancelDto, query, user);
  }
}
