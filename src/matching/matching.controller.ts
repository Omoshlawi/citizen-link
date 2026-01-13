import { Controller, Get, Query } from '@nestjs/common';
import { MatchingService } from './matching.service';
import {
  QueryMatechesForFoundCaseDto,
  QueryMatechesForLostCaseDto,
} from './matching.dto';
import { ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorsResponse } from 'src/app.decorators';
import { GetDocumentCaseResponseDto } from '../document-cases/document-cases.dto';
import { RequireSystemPermission } from '../auth/auth.decorators';

@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}
  @Get('lost')
  @RequireSystemPermission({ match: ['query-case-matches'] })
  @ApiOperation({ summary: 'Query Matches for lost document case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse()
  queryMatchesForLostDocumentCase(@Query() query: QueryMatechesForLostCaseDto) {
    return this.matchingService.queryMatchesForLostDocumentCase(query);
  }
  @Get('found')
  @RequireSystemPermission({ match: ['query-case-matches'] })
  @ApiOperation({ summary: 'Query Matches for found document case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse()
  queryMatchesForFoundDocumentCase(
    @Query() query: QueryMatechesForFoundCaseDto,
  ) {
    return this.matchingService.queryMatchesForFoundDocumentCase(query);
  }
}
