import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { QuerySimilarDocumentCaseResponsesDto } from '../document-cases/document-cases.dto';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import {
  GetMatchResponseDto,
  QueryMatchesDto,
  QueryMatchesForFoundCaseDto,
  QueryMatchesForLostCaseDto,
  QueryMatchesResponseDto,
} from './matching.dto';
import { MatchingService } from './matching.service';

@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}
  @Get('lost')
  @RequireSystemPermission({ match: ['query-case-matches'] })
  @ApiOperation({ summary: 'Query Matches for lost document case' })
  @ApiOkResponse({ type: QuerySimilarDocumentCaseResponsesDto })
  @ApiErrorsResponse()
  queryMatchesForLostDocumentCase(@Query() query: QueryMatchesForLostCaseDto) {
    return this.matchingService.queryMatchesForLostDocumentCase(query);
  }
  @Get('found')
  @RequireSystemPermission({ match: ['query-case-matches'] })
  @ApiOperation({ summary: 'Query Matches for found document case' })
  @ApiOkResponse({ type: QuerySimilarDocumentCaseResponsesDto })
  @ApiErrorsResponse()
  queryMatchesForFoundDocumentCase(
    @Query() query: QueryMatchesForFoundCaseDto,
  ) {
    return this.matchingService.queryMatchesForFoundDocumentCase(query);
  }

  @Get()
  @ApiOperation({ summary: 'Query Matches' })
  @ApiOkResponse({ type: QueryMatchesResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryMatchesDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.matchingService.findAll(query, originalUrl, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Match' })
  @ApiOkResponse({ type: GetMatchResponseDto })
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.matchingService.findOne(id, query, user);
  }

  @Delete(':id')
  @RequireSystemPermission({ documentType: ['delete'] })
  @ApiOperation({ summary: 'Delete Match' })
  @ApiOkResponse({ type: GetMatchResponseDto })
  @ApiErrorsResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
  ) {
    return this.matchingService.remove(id, query);
  }

  @Post(':id/restore')
  @RequireSystemPermission({ documentType: ['restore'] })
  @ApiOperation({ summary: 'Restore Match' })
  @ApiOkResponse({ type: GetMatchResponseDto })
  @ApiErrorsResponse()
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.matchingService.restore(id, query);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject your Match' })
  @ApiOkResponse({ type: GetMatchResponseDto })
  @ApiErrorsResponse()
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: StatusTransitionReasonsDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.matchingService.reject(id, rejectDto, user, query);
  }
}
