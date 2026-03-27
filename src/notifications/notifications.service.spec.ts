import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationService } from '../common/query-builder';
import { CustomRepresentationService } from '../common/query-builder/representation.service';
import { SortService } from '../common/query-builder/sort.service';
import { NotificationChannel, NotificationStatus } from '../../generated/prisma/enums';

const mockPrisma = {
  notificationLog: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
};
const mockPagination = {
  buildSafePaginationQuery: jest.fn().mockReturnValue({}),
  buildPaginationControls: jest.fn().mockReturnValue({ totalCount: 0, totalPages: 0, currentPage: 1, pageSize: 10, next: null, prev: null }),
};
const mockRepresentation = { buildCustomRepresentationQuery: jest.fn().mockReturnValue({}) };
const mockSort = { buildSortQuery: jest.fn().mockReturnValue({}) };

const adminUser = { id: 'admin-1', role: 'admin' } as any;
const regularUser = { id: 'user-1', role: 'user' } as any;

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaginationService, useValue: mockPagination },
        { provide: CustomRepresentationService, useValue: mockRepresentation },
        { provide: SortService, useValue: mockSort },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne()', () => {
    const log = {
      id: 'log-1',
      userId: 'user-1',
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.SENT,
    };

    it('returns the log when admin requests any log', async () => {
      mockPrisma.notificationLog.findUnique.mockResolvedValue(log);
      await expect(service.findOne('log-1', adminUser)).resolves.toEqual(log);
    });

    it('returns the log when the user requests their own log', async () => {
      mockPrisma.notificationLog.findUnique.mockResolvedValue(log);
      await expect(service.findOne('log-1', regularUser)).resolves.toEqual(log);
    });

    it('throws NotFoundException when log does not exist', async () => {
      mockPrisma.notificationLog.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', regularUser)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-admin requests another user\'s log', async () => {
      mockPrisma.notificationLog.findUnique.mockResolvedValue({ ...log, userId: 'other-user' });
      await expect(service.findOne('log-1', regularUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove()', () => {
    const log = { id: 'log-1', userId: 'user-1' };

    it('deletes the log when admin requests', async () => {
      mockPrisma.notificationLog.findUnique.mockResolvedValue(log);
      mockPrisma.notificationLog.delete.mockResolvedValue(log);
      await expect(service.remove('log-1', adminUser, {})).resolves.toEqual(log);
    });

    it('throws ForbiddenException when non-admin tries to delete', async () => {
      mockPrisma.notificationLog.findUnique.mockResolvedValue(log);
      await expect(service.remove('log-1', regularUser, {})).rejects.toThrow(ForbiddenException);
    });
  });
});
