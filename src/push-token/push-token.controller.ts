import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Delete,
  Param,
  Patch,
} from '@nestjs/common';
import { PushTokenService } from './push-token.service';
import {
  GetPushTokenResponseDto,
  QueryPushTokenDto,
  SetPushTokenDto,
} from './push-token.dto';
import { Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from 'src/app.decorators';

@Controller('push-token')
export class PushTokenController {
  constructor(private readonly pushTokenService: PushTokenService) {}

  @Get()
  @ApiOperation({ summary: 'Query Push Tokens' })
  @ApiOkResponse({ type: GetPushTokenResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  findAll(
    @Query() query: QueryPushTokenDto,
    @Session() { user }: UserSession,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.pushTokenService.findAll(query, user, originalUrl);
  }

  @Post()
  @ApiOperation({ summary: 'Set Push Token' })
  @ApiOkResponse({ type: GetPushTokenResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  setPushToken(
    @Body() dto: SetPushTokenDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.pushTokenService.setPushToken(dto, user, query);
  }

  @Delete(':token')
  @ApiOperation({ summary: 'Delete Push Token' })
  @ApiOkResponse({ type: GetPushTokenResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  remove(
    @Param('token') token: string,
    @Session() { user }: UserSession,
    @Query() query: DeleteQueryDto,
  ) {
    return this.pushTokenService.remove(token, user, query);
  }

  @Patch(':token/restore')
  @ApiOperation({ summary: 'Restore Push Token' })
  @ApiOkResponse({ type: GetPushTokenResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  restore(
    @Param('token') token: string,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.pushTokenService.restore(token, user, query);
  }
}
