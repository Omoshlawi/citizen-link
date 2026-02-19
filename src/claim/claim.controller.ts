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
  CancelClaimDto,
  CreateClaimDto,
  GetClaimResponseDto,
  QueryClaimDto,
  QueryClaimResponseDto,
  RejectClaimDto,
  UpdateClaimDto,
  VerifyClaimDto,
} from './claim.dto';
import { ClaimService } from './claim.service';

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
    @Body() rejectDto: RejectClaimDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.reject(id, rejectDto, user, query);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify Claim' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ claim: ['verify'] })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() verifyDto: VerifyClaimDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.verify(id, verifyDto, user, query);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel Claim' })
  @ApiOkResponse({ type: GetClaimResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelDto: CancelClaimDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.claimService.cancel(id, cancelDto, user, query);
  }
}
