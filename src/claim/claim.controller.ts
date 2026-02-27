import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { RequireSystemPermission } from 'src/auth/auth.decorators';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import {
  CreateClaimDto,
  GetClaimResponseDto,
  QueryClaimDto,
  QueryClaimResponseDto,
  UpdateClaimDto,
} from './claim.dto';
import { ClaimService } from './claim.service';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';

@Controller('claim')
export class ClaimController {
  constructor(private readonly claimService: ClaimService) {}

  @Post()
  @ApiOperation({ summary: 'Create Claim' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  create(
    @Body() createDocumentTypeDto: CreateClaimDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.create(createDocumentTypeDto, query, user);
  }
  @Get()
  @ApiOperation({ summary: 'Query Claims' })
  @ApiOkResponse({ type: QueryClaimResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryClaimDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.findAll(query, originalUrl, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Claim' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.findOne(id, query, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Claim' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDocumentTypeDto: UpdateClaimDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.claimService.update(id, updateDocumentTypeDto, query);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject Claim' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ claim: ['reject'] })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.reject(id, rejectDto, user, query, false);
  }

  @Post(':id/reject-reviewed')
  @ApiOperation({ summary: 'Reject Claim after reviewing dispute' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ claim: ['review-dispute'] })
  rejectReviewed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.reject(id, rejectDto, user, query, true);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify Claim' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ claim: ['verify'] })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() verifyDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.verify(id, verifyDto, user, query, false);
  }

  @Post(':id/verify-reviewed')
  @ApiOperation({ summary: 'Verify Claim after reviewing dispute' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ claim: ['review-dispute'] })
  verifyReviewed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() verifyDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.verify(id, verifyDto, user, query, true);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel your Claim' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.cancel(id, cancelDto, user, query);
  }

  @Post(':id/dispute')
  @ApiOperation({ summary: 'Request my rejected claim review' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  dispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() disputeDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.dispute(id, disputeDto, user, query);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Review rejected claim dispute' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ claim: ['review-dispute'] })
  reviewDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reviewDisputeDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.reviewDispute(id, reviewDisputeDto, user, query);
  }
}
