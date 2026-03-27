/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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
  NotificationEventResponseDto,
  QueryNotificationLogDto,
  QueryNotificationEventResponseDto,
  TestNotificationDto,
} from './notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly dispatchService: NotificationDispatchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Query Notification Events' })
  @ApiOkResponse({ type: QueryNotificationEventResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  findAll(
    @Query() query: QueryNotificationLogDto,
    @Session() { user }: UserSession,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.notificationsService.findAll(query, user, originalUrl);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread Notification Events' })
  @ApiOkResponse({ schema: { properties: { count: { type: 'number' } } } })
  getUnreadCount(@Session() { user }: UserSession) {
    return this.notificationsService.getUnreadCount(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Notification Event' })
  @ApiOkResponse({ type: NotificationEventResponseDto })
  @ApiErrorsResponse()
  findOne(@Param('id') id: string, @Session() { user }: UserSession) {
    return this.notificationsService.findOne(id, user);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get delivery logs for a Notification Event' })
  @ApiErrorsResponse()
  getEventLogs(@Param('id') id: string, @Session() { user }: UserSession) {
    return this.notificationsService.getEventLogs(id, user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark Notification Event as Read' })
  @ApiOkResponse({ type: NotificationEventResponseDto })
  @ApiErrorsResponse()
  markRead(@Param('id') id: string, @Session() { user }: UserSession) {
    return this.notificationsService.markRead(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Notification Event' })
  @ApiOkResponse({ type: NotificationEventResponseDto })
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
  @ApiOperation({ summary: 'Restore Notification Event' })
  @ApiOkResponse({ type: NotificationEventResponseDto })
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
  testNotification(
    @Body() dto: TestNotificationDto,
    @Session() { user }: UserSession,
  ) {
    return this.dispatchService.send({
      templateKey: dto.templateKey,
      inlineContent: dto.inlineContent,
      channels: dto.channels,
      priority: dto.priority,
      recipient: dto.recipient,
      userId: user.id,
    });
  }
}
