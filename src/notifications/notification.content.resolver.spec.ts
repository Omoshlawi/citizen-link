import { Test, TestingModule } from '@nestjs/testing';
import { NotificationContentResolver } from './notification.content.resolver';
import { TemplatesService } from '../common/templates/templates.service';
import { UserSettingService } from '../common/settings/settings.user.service';
import { NOTIFICATION_SLOTS } from '../common/templates/template.constants';
import { NotificationChannel } from '../../generated/prisma/enums';

const mockTemplatesService = {
  renderAll: jest.fn(),
};

const mockUserSettingService = {
  getAllowedChannels: jest.fn(),
  isQuietHours: jest.fn(),
};

describe('NotificationContentResolver', () => {
  let resolver: NotificationContentResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationContentResolver,
        { provide: TemplatesService, useValue: mockTemplatesService },
        { provide: UserSettingService, useValue: mockUserSettingService },
      ],
    }).compile();

    resolver = module.get<NotificationContentResolver>(
      NotificationContentResolver,
    );
    jest.clearAllMocks();
  });

  describe('filterAllowedChannels()', () => {
    it('returns all channels unchanged when force is true', async () => {
      const channels = [NotificationChannel.EMAIL, NotificationChannel.SMS];
      const result = await resolver.filterAllowedChannels(
        channels,
        'user-1',
        true,
      );
      expect(result).toEqual(channels);
      expect(mockUserSettingService.getAllowedChannels).not.toHaveBeenCalled();
    });

    it('returns all channels unchanged when no userId', async () => {
      const channels = [NotificationChannel.EMAIL, NotificationChannel.PUSH];
      const result = await resolver.filterAllowedChannels(channels, undefined);
      expect(result).toEqual(channels);
    });

    it('filters channels based on user preferences', async () => {
      mockUserSettingService.getAllowedChannels.mockResolvedValue([
        NotificationChannel.EMAIL,
      ]);
      mockUserSettingService.isQuietHours.mockResolvedValue(false);

      const result = await resolver.filterAllowedChannels(
        [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS,
          NotificationChannel.PUSH,
        ],
        'user-1',
      );
      expect(result).toEqual([NotificationChannel.EMAIL]);
    });

    it('suppresses SMS and PUSH during quiet hours but keeps EMAIL', async () => {
      mockUserSettingService.getAllowedChannels.mockResolvedValue([
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
        NotificationChannel.PUSH,
      ]);
      mockUserSettingService.isQuietHours.mockResolvedValue(true);

      const result = await resolver.filterAllowedChannels(
        [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS,
          NotificationChannel.PUSH,
        ],
        'user-1',
      );
      expect(result).toEqual([NotificationChannel.EMAIL]);
    });

    it('quiet hours do NOT suppress EMAIL (email is non-intrusive)', async () => {
      mockUserSettingService.getAllowedChannels.mockResolvedValue([
        NotificationChannel.EMAIL,
      ]);
      mockUserSettingService.isQuietHours.mockResolvedValue(true);

      const result = await resolver.filterAllowedChannels(
        [NotificationChannel.EMAIL],
        'user-1',
      );
      expect(result).toContain(NotificationChannel.EMAIL);
    });
  });

  describe('resolve() — inline source', () => {
    const recipient = {
      email: 'user@example.com',
      phone: '+254712345678',
      pushTokens: ['ExponentPushToken[abc123]'],
    };

    it('returns email payload for inline EMAIL', async () => {
      const result = await resolver.resolve(
        { type: 'inline', email: { subject: 'Hello', html: '<p>Hi</p>' } },
        NotificationChannel.EMAIL,
        recipient,
      );
      expect(result).toEqual({
        to: recipient.email,
        subject: 'Hello',
        html: '<p>Hi</p>',
      });
    });

    it('returns sms payload for inline SMS', async () => {
      const result = await resolver.resolve(
        { type: 'inline', sms: { body: 'Your OTP is 1234' } },
        NotificationChannel.SMS,
        recipient,
      );
      expect(result).toEqual({ to: recipient.phone, body: 'Your OTP is 1234' });
    });

    it('returns push payload for inline PUSH', async () => {
      const result = await resolver.resolve(
        {
          type: 'inline',
          push: { title: 'Alert', body: 'Something happened' },
        },
        NotificationChannel.PUSH,
        recipient,
      );
      expect(result).toEqual({
        to: recipient.pushTokens[0],
        title: 'Alert',
        body: 'Something happened',
      });
    });

    it('returns null when recipient has no email for EMAIL channel', async () => {
      const result = await resolver.resolve(
        { type: 'inline', email: { subject: 'Hi', html: '<p>Hi</p>' } },
        NotificationChannel.EMAIL,
        { phone: '+254712345678' },
      );
      expect(result).toBeNull();
    });

    it('returns null when inline has no content for the requested channel', async () => {
      const result = await resolver.resolve(
        { type: 'inline', email: { subject: 'Hi', html: '<p>Hi</p>' } },
        NotificationChannel.SMS,
        recipient,
      );
      expect(result).toBeNull();
    });
  });

  describe('resolve() — template source', () => {
    const recipient = {
      email: 'user@example.com',
      phone: '+254712345678',
      pushTokens: ['ExponentPushToken[abc]'],
    };

    it('returns email payload from template slots', async () => {
      mockTemplatesService.renderAll.mockResolvedValue({
        slots: {
          [NOTIFICATION_SLOTS.EMAIL_SUBJECT]: 'Welcome',
          [NOTIFICATION_SLOTS.EMAIL_BODY]: '<p>Welcome!</p>',
        },
        metadata: { channels: { email: true, sms: false, push: false } },
      });

      const result = await resolver.resolve(
        { type: 'template', templateKey: 'welcome', data: {} },
        NotificationChannel.EMAIL,
        recipient,
      );
      expect(result).toMatchObject({
        to: recipient.email,
        subject: 'Welcome',
        html: '<p>Welcome!</p>',
      });
    });

    it('returns null when template disables the channel', async () => {
      mockTemplatesService.renderAll.mockResolvedValue({
        slots: { [NOTIFICATION_SLOTS.SMS_BODY]: 'Hello' },
        metadata: { channels: { email: true, sms: false, push: false } },
      });

      const result = await resolver.resolve(
        { type: 'template', templateKey: 'welcome', data: {} },
        NotificationChannel.SMS,
        recipient,
      );
      expect(result).toBeNull();
    });

    it('handles malformed push_data JSON gracefully (sends push without data)', async () => {
      mockTemplatesService.renderAll.mockResolvedValue({
        slots: {
          [NOTIFICATION_SLOTS.PUSH_TITLE]: 'Alert',
          [NOTIFICATION_SLOTS.PUSH_BODY]: 'Check this out',
          [NOTIFICATION_SLOTS.PUSH_DATA]: '{ invalid json {{',
        },
        metadata: { channels: { email: false, sms: false, push: true } },
      });

      const result = await resolver.resolve(
        { type: 'template', templateKey: 'alert', data: {} },
        NotificationChannel.PUSH,
        recipient,
      );
      // Should still return a push payload — bad data doesn't block delivery
      expect(result).not.toBeNull();
      expect((result as any).data).toBeUndefined();
    });

    it('returns null when no push tokens on recipient', async () => {
      mockTemplatesService.renderAll.mockResolvedValue({
        slots: {
          [NOTIFICATION_SLOTS.PUSH_TITLE]: 'Hi',
          [NOTIFICATION_SLOTS.PUSH_BODY]: 'Body',
        },
        metadata: { channels: { push: true } },
      });

      const result = await resolver.resolve(
        { type: 'template', templateKey: 'alert', data: {} },
        NotificationChannel.PUSH,
        { email: 'user@example.com' }, // no pushTokens
      );
      expect(result).toBeNull();
    });
  });
});
