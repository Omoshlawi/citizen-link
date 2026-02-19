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
import { MatchingService } from './matching.service';
import {
  GetMatchResponseDto,
  QueryMatchesDto,
  QueryMatchesResponseDto,
  QueryMatechesForFoundCaseDto,
  QueryMatechesForLostCaseDto,
  RejectMatchDto,
} from './matching.dto';
import { ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import { GetDocumentCaseResponseDto } from '../document-cases/document-cases.dto';
import { RequireSystemPermission } from '../auth/auth.decorators';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import { Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '../auth/auth.types';

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
    @Body() rejectDto: RejectMatchDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.matchingService.reject(id, rejectDto, user, query);
  }
}
