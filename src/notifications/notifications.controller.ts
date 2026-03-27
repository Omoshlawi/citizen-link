import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '../auth/auth.types';
import { RequireSystemPermission } from '../auth/auth.decorators';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchService } from './notifications.dispatch.service';
import {
  GetNotificationLogResponseDto,
  QueryNotificationLogDto,
  QueryNotificationLogResponseDto,
  TestNotificationDto,
} from './notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly dispatchService: NotificationDispatchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Query Notification Logs' })
  @ApiOkResponse({ type: QueryNotificationLogResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  findAll(
    @Query() query: QueryNotificationLogDto,
    @Session() { user }: UserSession,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.notificationsService.findAll(query, user, originalUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Notification Log' })
  @ApiOkResponse({ type: GetNotificationLogResponseDto })
  @ApiErrorsResponse()
  findOne(@Param('id') id: string, @Session() { user }: UserSession) {
    return this.notificationsService.findOne(id, user);
  }

  @Delete(':id')
  @RequireSystemPermission({ notification: ['delete'] })
  @ApiOperation({ summary: 'Delete Notification Log' })
  @ApiOkResponse({ type: GetNotificationLogResponseDto })
  @ApiErrorsResponse()
  remove(
    @Param('id') id: string,
    @Session() { user }: UserSession,
    @Query() query: DeleteQueryDto,
  ) {
    return this.notificationsService.remove(id, user, query);
  }

  @Post(':id/restore')
  @RequireSystemPermission({ notification: ['delete'] })
  @ApiOperation({ summary: 'Restore Notification Log' })
  @ApiOkResponse({ type: GetNotificationLogResponseDto })
  @ApiErrorsResponse()
  restore(
    @Param('id') id: string,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.notificationsService.restore(id, user, query);
  }

  @Post('test')
  @RequireSystemPermission({ notification: ['test'] })
  @ApiOperation({ summary: 'Send Test Notification' })
  @ApiErrorsResponse({ badRequest: true })
  testNotification(@Body() dto: TestNotificationDto) {
    return this.dispatchService.send({
      templateKey: dto.templateKey,
      inlineContent: dto.inlineContent,
      channels: dto.channels,
      priority: dto.priority,
      recipient: dto.recipient,
    });
  }
}
