import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../query-builder';
import {
  AcceptMatchDto,
  AdminVerifyMatchDto,
  CompleteMatchDto,
  QueryMatchesDto,
  RejectMatchDto,
} from './matches.dto';
import { MatchesService } from './matches.service';
import { RequireSystemPermission } from '../auth/auth.decorators';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'Query Matches' })
  @ApiOkResponse()
  @ApiErrorsResponse({ badRequest: true })
  findAll(@Query() query: QueryMatchesDto, @OriginalUrl() originalUrl: string) {
    return this.matchesService.findAll(query, originalUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Match' })
  @ApiOkResponse()
  @ApiErrorsResponse({ badRequest: true, notFound: true })
  findOne(
    @Param('id') id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.matchesService.findOne(id, query);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept Match' })
  @ApiOkResponse()
  @ApiErrorsResponse({ badRequest: true, notFound: true })
  acceptMatch(
    @Param('id') id: string,
    @Body() acceptMatchDto: AcceptMatchDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.matchesService.acceptMatch(id, acceptMatchDto, user.id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject Match' })
  @ApiOkResponse()
  @ApiErrorsResponse({ badRequest: true, notFound: true })
  rejectMatch(
    @Param('id') id: string,
    @Body() rejectMatchDto: RejectMatchDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.matchesService.rejectMatch(id, rejectMatchDto, user.id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete Match' })
  @ApiOkResponse()
  @ApiErrorsResponse({ badRequest: true, notFound: true })
  completeMatch(
    @Param('id') id: string,
    @Body() completeMatchDto: CompleteMatchDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.matchesService.completeMatch(id, completeMatchDto, user.id);
  }

  @Patch(':id/admin-verify')
  @RequireSystemPermission({ match: ['verify'] })
  @ApiOperation({ summary: 'Admin Verify Match' })
  @ApiOkResponse()
  @ApiErrorsResponse({ badRequest: true, notFound: true })
  adminVerifyMatch(
    @Param('id') id: string,
    @Body() adminVerifyDto: AdminVerifyMatchDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.matchesService.adminVerifyMatch(id, adminVerifyDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Match' })
  @ApiOkResponse()
  @ApiErrorsResponse({ badRequest: true })
  remove(
    @Param('id') id: string,
    @Query() query: DeleteQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.matchesService.remove(id, query, user.id);
  }
}
