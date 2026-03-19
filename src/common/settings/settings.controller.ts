import { Controller, Query, Get, Post, Body, Delete } from '@nestjs/common';
import { SettingsService } from './settings.service';
import {
  SetSettingDto,
  QuerySettingObjectDto,
  QuerySettingsDto,
  SetSettingObjectDto,
  DeleteSettingDto,
  DeleteSettingResponseDto,
} from './settings.dto';
import { CustomRepresentationQueryDto, OriginalUrl } from '../query-builder';
import { ApiOperation } from '@nestjs/swagger';
import { ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../../app.decorators';
import { Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '../../auth/auth.types';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Query Settings' })
  @ApiOkResponse({ type: QuerySettingsDto })
  @ApiErrorsResponse()
  async getSettings(
    @Query() query: QuerySettingsDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.settingsService.queryAll(query, originalUrl, user);
  }
  @Get('object')
  @ApiOperation({ summary: 'Query Settings object' })
  @ApiOkResponse({ type: QuerySettingsDto })
  @ApiErrorsResponse()
  async getSettingsObject(
    @Query() query: QuerySettingObjectDto,
    @Session() { user }: UserSession,
  ) {
    return this.settingsService.queryObject(query, user);
  }

  @Post()
  @ApiOperation({ summary: 'Set Setting' })
  @ApiOkResponse({ type: QuerySettingsDto })
  @ApiErrorsResponse()
  async setSetting(
    @Body() body: SetSettingDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.settingsService.setSetting(body, user, query);
  }

  @Post('object')
  @ApiOperation({ summary: 'Set Setting Object' })
  @ApiOkResponse({ type: QuerySettingsDto })
  @ApiErrorsResponse()
  async setSettingObject(
    @Body() body: SetSettingObjectDto,
    @Session() { user }: UserSession,
  ) {
    return this.settingsService.setObjectSetting(body, user);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete Setting' })
  @ApiOkResponse({ type: DeleteSettingResponseDto })
  @ApiErrorsResponse()
  async deleteSetting(
    @Body() body: DeleteSettingDto,
    @Session() { user }: UserSession,
  ) {
    return this.settingsService.deleteSetting(body, user);
  }
}
