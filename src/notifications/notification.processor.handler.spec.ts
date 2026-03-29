import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationProcessorHandler } from './notification.processor.handler';
import { PrismaService } from '../prisma/prisma.service';
import { PushTokenService } from '../push-token/push-token.service';
import { NotificationContentResolver } from './notification.content.resolver';
import { EmailChannelService } from './channels/email/email.channel.service';
import { SmsChannelService } from './channels/sms/sms.channel.service';
import { PushChannelService } from './channels/push/push.channel.service';
import { NOTIFICATION_QUEUES } from './notification.constants';
import {
  NotificationChannel,
  NotificationStatus,
} from '../../generated/prisma/enums';
import { NotificationJob } from './notification.interfaces';
import { Job } from 'bullmq';

const makeMockJob = (
  overrides: Partial<NotificationJob> = {},
  attemptsMade = 0,
): Job<NotificationJob> =>
  ({
    id: 'job-1',
    attemptsMade,
    opts: { attempts: 3 },
    data: {
      logId: 'log-1',
      channel: NotificationChannel.EMAIL,
      source: {
        type: 'inline',
        email: { subject: 'Test', html: '<p>Test</p>' },
      },
      recipient: { email: 'test@example.com' },
      userId: undefined,
      force: false,
      attempt: 0,
      ...overrides,
    },
  }) as unknown as Job<NotificationJob>;

describe('NotificationProcessorHandler', () => {
  let handler: NotificationProcessorHandler;
  let prisma: jest.Mocked<PrismaService>;
  let contentResolver: jest.Mocked<NotificationContentResolver>;
  let emailChannel: jest.Mocked<EmailChannelService>;
  let pushChannel: jest.Mocked<PushChannelService>;
  let pushToken: jest.Mocked<PushTokenService>;
  let receiptQueue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notificationLog: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    contentResolver = { resolve: jest.fn() } as any;
    emailChannel = { send: jest.fn() } as any;
    pushChannel = { send: jest.fn() } as any;
    pushToken = {
      deactivatePushToken: jest.fn().mockResolvedValue(undefined),
    } as any;
    receiptQueue = { add: jest.fn().mockResolvedValue({}) };

    const smsChannel = { send: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessorHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationContentResolver, useValue: contentResolver },
        { provide: EmailChannelService, useValue: emailChannel },
        { provide: SmsChannelService, useValue: smsChannel },
        { provide: PushChannelService, useValue: pushChannel },
        { provide: PushTokenService, useValue: pushToken },
        {
          provide: getQueueToken(NOTIFICATION_QUEUES.PUSH_RECEIPT),
          useValue: receiptQueue,
        },
      ],
    }).compile();

    handler = module.get<NotificationProcessorHandler>(
      NotificationProcessorHandler,
    );
  });

  describe('process()', () => {
    it('marks log QUEUED on first attempt and SENT on success', async () => {
      contentResolver.resolve.mockResolvedValue({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      emailChannel.send.mockResolvedValue({
        success: true,
        messageId: 'msg-1',
        providerName: 'mailpit',
      });

      await handler.process(makeMockJob());

      expect(prisma.notificationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'QUEUED' }),
        }),
      );
      expect(prisma.notificationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: NotificationStatus.SENT }),
        }),
      );
    });

    it('marks log SKIPPED when resolver returns null (no content for channel)', async () => {
      contentResolver.resolve.mockResolvedValue(null);

      await handler.process(makeMockJob());

      expect(prisma.notificationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SKIPPED' }),
        }),
      );
    });

    it('throws and records lastError (truncated) on provider failure', async () => {
      contentResolver.resolve.mockResolvedValue({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      emailChannel.send.mockResolvedValue({
        success: false,
        error: 'SMTP timeout',
      });

      await expect(handler.process(makeMockJob())).rejects.toThrow(
        'SMTP timeout',
      );

      expect(prisma.notificationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastError: 'SMTP timeout' }),
        }),
      );
    });

    it('truncates lastError to 500 characters', async () => {
      const longError = 'x'.repeat(1000);
      contentResolver.resolve.mockResolvedValue({
        to: 'a@b.com',
        subject: 'x',
        html: 'x',
      });
      emailChannel.send.mockResolvedValue({ success: false, error: longError });

      await expect(handler.process(makeMockJob())).rejects.toThrow();

      const call = (prisma.notificationLog.update as jest.Mock).mock.calls.find(
        ([arg]) => arg.data?.lastError,
      );
      expect(call[0].data.lastError.length).toBeLessThanOrEqual(500);
    });

    it('deactivates push token on DeviceNotRegistered error', async () => {
      const pushPayload = {
        to: 'ExponentPushToken[abc]',
        title: 'Hi',
        body: 'Test',
      };
      contentResolver.resolve.mockResolvedValue(pushPayload);
      pushChannel.send.mockResolvedValue({
        success: false,
        error: 'DeviceNotRegistered',
        errorCode: 'DeviceNotRegistered',
      });

      const job = makeMockJob({
        channel: NotificationChannel.PUSH,
        recipient: { pushTokens: [pushPayload.to] },
      });
      await expect(handler.process(job)).rejects.toThrow();

      expect(pushToken.deactivatePushToken).toHaveBeenCalledWith(
        pushPayload.to,
      );
    });

    it('does NOT deactivate token on transient push error', async () => {
      const pushPayload = {
        to: 'ExponentPushToken[abc]',
        title: 'Hi',
        body: 'Test',
      };
      contentResolver.resolve.mockResolvedValue(pushPayload);
      pushChannel.send.mockResolvedValue({
        success: false,
        error: 'Network timeout',
        errorCode: 'EXPO_NETWORK_ERROR',
      });

      const job = makeMockJob({
        channel: NotificationChannel.PUSH,
        recipient: { pushTokens: [pushPayload.to] },
      });
      await expect(handler.process(job)).rejects.toThrow();

      expect(pushToken.deactivatePushToken).not.toHaveBeenCalled();
    });

    it('enqueues a receipt-check job 15 minutes after a successful push', async () => {
      const pushPayload = {
        to: 'ExponentPushToken[abc]',
        title: 'Hi',
        body: 'Msg',
      };
      contentResolver.resolve.mockResolvedValue(pushPayload);
      pushChannel.send.mockResolvedValue({
        success: true,
        messageId: 'receipt-id-42',
        providerName: 'expo',
      });

      const job = makeMockJob({
        channel: NotificationChannel.PUSH,
        recipient: { pushTokens: [pushPayload.to] },
      });
      await handler.process(job);

      expect(receiptQueue.add).toHaveBeenCalledWith(
        'check-receipt',
        expect.objectContaining({
          receiptId: 'receipt-id-42',
          token: pushPayload.to,
        }),
        { delay: 15 * 60 * 1000 },
      );
    });

    it('does NOT enqueue a receipt job for email sends', async () => {
      contentResolver.resolve.mockResolvedValue({
        to: 'test@example.com',
        subject: 'x',
        html: 'x',
      });
      emailChannel.send.mockResolvedValue({
        success: true,
        messageId: 'msg-1',
        providerName: 'mailpit',
      });

      await handler.process(makeMockJob());

      expect(receiptQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('onFailed()', () => {
    it('marks log FAILED with truncated error after max attempts', async () => {
      const longError = new Error('e'.repeat(600));
      const job = makeMockJob({}, 3);

      await handler.onFailed(job, longError);

      expect(prisma.notificationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: NotificationStatus.FAILED,
            lastError: expect.stringMatching(/^e{500}$/),
          }),
        }),
      );
    });

    it('does not update log if attempts have not been exhausted', async () => {
      const job = makeMockJob({}, 1); // only 1 attempt made, max is 3
      await handler.onFailed(job, new Error('transient'));
      expect(prisma.notificationLog.update).not.toHaveBeenCalled();
    });
  });
});
