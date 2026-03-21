import { Body, Controller, Get } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationPriority } from './notification.interfaces';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('test/inline')
  async testNotification() {
    return this.notificationsService.sendInline({
      channels: ['EMAIL'],
      recipient: {
        email: 'test@citizenlink.com',
        pushTokens: ['test-tokens'],
      },
      priority: NotificationPriority.HIGH,
      email: {
        subject: 'Test Notification',
        html: '<h1>Test Notification</h1>',
      },
      push: {
        title: 'Test Notification',
        body: 'Test Notification',
      },
    });
  }
}
