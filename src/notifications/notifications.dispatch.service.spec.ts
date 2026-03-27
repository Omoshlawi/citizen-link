import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationDispatchService } from './notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushTokenService } from '../push-token/push-token.service';
import { NotificationContentResolver } from './notification.content.resolver';
import { NOTIFICATION_QUEUES } from './notification.constants';
import { NotificationChannel } from '../../generated/prisma/enums';
import { NotificationPriority } from './notification.interfaces';

const makeQueue = () => ({ addBulk: jest.fn().mockResolvedValue([]) });

describe('NotificationDispatchService', () => {
  let service: NotificationDispatchService;
  let prisma: jest.Mocked<PrismaService>;
  let contentResolver: jest.Mocked<NotificationContentResolver>;
  let pushToken: jest.Mocked<PushTokenService>;
  let highQueue: ReturnType<typeof makeQueue>;
  let normalQueue: ReturnType<typeof makeQueue>;
  let lowQueue: ReturnType<typeof makeQueue>;

  beforeEach(async () => {
    prisma = {
      notificationLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (ops: any[]) =>
        Promise.all(ops),
      ),
    } as any;

    contentResolver = {
      filterAllowedChannels: jest.fn().mockResolvedValue([NotificationChannel.EMAIL]),
    } as any;

    pushToken = {
      getPushTokens: jest.fn().mockResolvedValue(['ExponentPushToken[abc]']),
    } as any;

    highQueue = makeQueue();
    normalQueue = makeQueue();
    lowQueue = makeQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDispatchService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationContentResolver, useValue: contentResolver },
        { provide: PushTokenService, useValue: pushToken },
        { provide: getQueueToken(NOTIFICATION_QUEUES.HIGH), useValue: highQueue },
        { provide: getQueueToken(NOTIFICATION_QUEUES.NORMAL), useValue: normalQueue },
        { provide: getQueueToken(NOTIFICATION_QUEUES.LOW), useValue: lowQueue },
      ],
    }).compile();

    service = module.get<NotificationDispatchService>(NotificationDispatchService);
  });

  describe('sendFromTemplate()', () => {
    it('creates a NotificationLog and enqueues a job', async () => {
      await service.sendFromTemplate({
        templateKey: 'welcome',
        recipient: { email: 'user@example.com' },
      });

      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: NotificationChannel.EMAIL,
            status: 'PENDING',
          }),
        }),
      );
      expect(normalQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'email' }),
        ]),
      );
    });

    it('routes HIGH priority sends to the high queue', async () => {
      await service.sendFromTemplate({
        templateKey: 'otp',
        recipient: { phone: '+254712345678' },
        priority: NotificationPriority.HIGH,
        force: true,
      });

      expect(highQueue.addBulk).toHaveBeenCalled();
      expect(normalQueue.addBulk).not.toHaveBeenCalled();
    });
  });

  describe('sendInline()', () => {
    it('creates a log and enqueues for each allowed channel', async () => {
      contentResolver.filterAllowedChannels.mockResolvedValue([
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
      ]);

      await service.sendInline({
        recipient: { email: 'a@b.com', phone: '+254700000000' },
        email: { subject: 'Hi', html: '<p>Hi</p>' },
        sms: { body: 'Hi there' },
      });

      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(2);
      expect(normalQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'email' }),
          expect.objectContaining({ name: 'sms' }),
        ]),
      );
    });

    it('creates no log and enqueues nothing when all channels are suppressed', async () => {
      contentResolver.filterAllowedChannels.mockResolvedValue([]);

      await service.sendInline({
        recipient: { email: 'a@b.com' },
        email: { subject: 'Hi', html: '<p>Hi</p>' },
      });

      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
      expect(normalQueue.addBulk).not.toHaveBeenCalled();
    });
  });

  describe('enqueue() — push token pre-loading', () => {
    it('loads push tokens from DB when PUSH is allowed and none are on the recipient', async () => {
      contentResolver.filterAllowedChannels.mockResolvedValue([NotificationChannel.PUSH]);

      await service.sendFromTemplate({
        templateKey: 'alert',
        recipient: { email: 'a@b.com' }, // no pushTokens
        userId: 'user-1',
      });

      expect(pushToken.getPushTokens).toHaveBeenCalledWith('user-1');
      // The job should carry the resolved tokens
      const jobData = normalQueue.addBulk.mock.calls[0][0][0].data;
      expect(jobData.recipient.pushTokens).toEqual(['ExponentPushToken[abc]']);
    });

    it('skips token loading when pushTokens are already provided', async () => {
      contentResolver.filterAllowedChannels.mockResolvedValue([NotificationChannel.PUSH]);

      await service.sendFromTemplate({
        templateKey: 'alert',
        recipient: { pushTokens: ['ExponentPushToken[existing]'] },
        userId: 'user-1',
      });

      expect(pushToken.getPushTokens).not.toHaveBeenCalled();
    });
  });

  describe('sendBulk()', () => {
    it('creates all logs in a transaction and enqueues a single addBulk call', async () => {
      contentResolver.filterAllowedChannels.mockResolvedValue([NotificationChannel.EMAIL]);
      (prisma.notificationLog.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'log-1' })
        .mockResolvedValueOnce({ id: 'log-2' });

      await service.sendBulk({
        templateKey: 'digest',
        priority: NotificationPriority.LOW,
        recipients: [
          { userId: 'u1', recipient: { email: 'a@a.com' }, data: {} },
          { userId: 'u2', recipient: { email: 'b@b.com' }, data: {} },
        ],
      });

      // All logs created atomically via $transaction
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Low-priority sends go to the low queue
      expect(lowQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(lowQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'email' }),
          expect.objectContaining({ name: 'email' }),
        ]),
      );
    });

    it('does nothing when all channels are suppressed for all recipients', async () => {
      contentResolver.filterAllowedChannels.mockResolvedValue([]);

      await service.sendBulk({
        templateKey: 'marketing',
        recipients: [{ recipient: { email: 'a@a.com' } }],
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
