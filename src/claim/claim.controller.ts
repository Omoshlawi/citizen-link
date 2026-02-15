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
import { ClaimService } from './claim.service';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CreateClaimDto,
  GetClaimResponseDto,
  QueryClaimDto,
  QueryClaimResponseDto,
  UpdateClaimDto,
} from './claim.dto';
import {
  CustomRepresentationQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import { Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '../auth/auth.types';

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
}
