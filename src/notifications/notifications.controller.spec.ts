jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: jest.fn(() => () => {}),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchService } from './notifications.dispatch.service';

const mockNotificationsService = {
  findAll: jest.fn().mockResolvedValue({ results: [], totalCount: 0, totalPages: 0, currentPage: 1, pageSize: 10, next: null, prev: null }),
  findOne: jest.fn().mockResolvedValue({ id: 'log-1' }),
  remove: jest.fn().mockResolvedValue({ id: 'log-1' }),
};

const mockDispatchService = {
  send: jest.fn().mockResolvedValue(undefined),
};

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: NotificationDispatchService, useValue: mockDispatchService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll() delegates to NotificationsService', async () => {
    const user = { id: 'u1', role: 'user' } as any;
    await controller.findAll({} as any, { user } as any, '/api/notifications');
    expect(mockNotificationsService.findAll).toHaveBeenCalledWith({}, user, '/api/notifications');
  });

  it('findOne() delegates to NotificationsService', async () => {
    const user = { id: 'u1', role: 'user' } as any;
    await controller.findOne('log-1', { user } as any);
    expect(mockNotificationsService.findOne).toHaveBeenCalledWith('log-1', user);
  });

  it('testNotification() delegates to NotificationDispatchService.send()', async () => {
    const dto = {
      templateKey: 'test.template',
      channels: [],
      priority: undefined,
      recipient: { email: 'test@example.com' },
    } as any;
    await controller.testNotification(dto);
    expect(mockDispatchService.send).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: 'test.template' }),
    );
  });
});
