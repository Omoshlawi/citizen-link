import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import { OriginalUrl } from '../query-builder';
import {
  GetCaseCurrentStatusResponseDto,
  GetCaseStatusTransitionHistoryResponseDto,
  QueryStatusTransitionDto,
} from './case-status-transitions.dto';
import { CaseStatusTransitionsService } from './case-status-transitions.service';

@Controller('documents/cases/:caseId/status-transitions')
export class CaseStatusTransitionsController {
  constructor(
    private readonly statusTransitionsService: CaseStatusTransitionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get Status Transition History' })
  @ApiOkResponse({ type: GetCaseStatusTransitionHistoryResponseDto })
  @ApiErrorsResponse({ notFound: true })
  getTransitionHistory(
    @Param('caseId') caseId: string,
    @Query() query: QueryStatusTransitionDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.statusTransitionsService.getTransitionHistory(
      caseId,
      query,
      originalUrl,
    );
  }

  @Get('current')
  @ApiOperation({ summary: 'Get Current Status' })
  @ApiOkResponse({ type: GetCaseCurrentStatusResponseDto })
  @ApiErrorsResponse({ notFound: true })
  getCurrentStatus(@Param('caseId') caseId: string) {
    return this.statusTransitionsService.getCurrentStatus(caseId);
  }
}
