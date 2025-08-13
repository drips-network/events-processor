/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import AccountSeenEventModel from '../../src/models/AccountSeenEventModel';
import DeadlineModel from '../../src/models/DeadlineModel';
import ScopedLogger from '../../src/core/ScopedLogger';
import AccountSeenEventHandler from '../../src/eventHandlers/AccountSeenEventHandler';
import * as accountIdUtils from '../../src/utils/accountIdUtils';
import * as getAccountType from '../../src/utils/getAccountType';
import * as isLatestEvent from '../../src/utils/isLatestEvent';
import type {
  AccountId,
  RepoDeadlineDriverId,
  RepoDriverId,
} from '../../src/core/types';

jest.mock('../../src/models/AccountSeenEventModel');
jest.mock('../../src/models/DeadlineModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/core/ScopedLogger');
jest.mock('../../src/utils/getAccountType');
jest.mock('../../src/utils/isLatestEvent');

describe('AccountSeenEventHandler', () => {
  let mockDbTransaction: any;
  let handler: AccountSeenEventHandler;
  let mockRequest: EventHandlerRequest<'AccountSeen(uint256,uint256,uint256,uint256,uint32)'>;

  beforeEach(() => {
    jest.clearAllMocks();

    handler = new AccountSeenEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          80920745289880686872077472087501508459438916877610571750365932290048n, // accountId
          80920745289880686872077472087501508459438916877610571750365932290049n, // repoAccountId
          80920745289880686872077472087501508459438916877610571750365932290050n, // recipientAccountId
          80920745289880686872077472087501508459438916877610571750365932290051n, // refundAccountId
          1704067200, // deadline (unix timestamp)
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
        eventSignature: 'AccountSeen(uint256,uint256,uint256,uint256,uint32)',
      } as EventData<'AccountSeen(uint256,uint256,uint256,uint256,uint32)'>,
    };

    mockDbTransaction = {
      LOCK: {
        UPDATE: 'UPDATE',
      },
    };

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));

    // Mock utility functions
    jest
      .spyOn(accountIdUtils, 'convertToRepoDeadlineDriverId')
      .mockReturnValue('deadline-account-id' as RepoDeadlineDriverId);
    jest
      .spyOn(accountIdUtils, 'convertToRepoDriverId')
      .mockReturnValue('repo-account-id' as RepoDriverId);
    jest
      .spyOn(accountIdUtils, 'convertToAccountId')
      .mockReturnValueOnce('receiver-account-id' as AccountId)
      .mockReturnValueOnce('refund-account-id' as AccountId);

    jest
      .mocked(getAccountType.getAccountType)
      .mockResolvedValueOnce('project')
      .mockResolvedValueOnce('address');

    jest.mocked(isLatestEvent.isLatestEvent).mockResolvedValue(true);

    ScopedLogger.prototype.log = jest.fn();
    ScopedLogger.prototype.bufferCreation = jest.fn();
    ScopedLogger.prototype.bufferUpdate = jest.fn();
    ScopedLogger.prototype.flush = jest.fn();
  });

  describe('_handle', () => {
    test('should create AccountSeenEventModel and new DeadlineModel when deadline does not exist', async () => {
      // Arrange
      const accountSeenEvent = {
        accountId: 'deadline-account-id',
        repoAccountId: 'repo-account-id',
        receiverAccountId: 'receiver-account-id',
        refundAccountId: 'refund-account-id',
        deadline: new Date(1704067200 * 1000),
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: mockRequest.event.blockTimestamp,
        transactionHash: 'requestTransactionHash',
      };

      const deadlineEntry = {
        accountId: 'deadline-account-id',
        receiverAccountId: 'receiver-account-id',
        receiverAccountType: 'project',
        claimableProjectId: 'repo-account-id',
        deadline: new Date(1704067200 * 1000),
        refundAccountId: 'refund-account-id',
        refundAccountType: 'address',
      };

      AccountSeenEventModel.create = jest
        .fn()
        .mockResolvedValue(accountSeenEvent);
      DeadlineModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([deadlineEntry, true]);

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      expect(AccountSeenEventModel.create).toHaveBeenCalledWith(
        {
          accountId: 'deadline-account-id',
          repoAccountId: 'repo-account-id',
          receiverAccountId: 'receiver-account-id',
          refundAccountId: 'refund-account-id',
          deadline: new Date(1704067200 * 1000),
          logIndex: 1,
          blockNumber: 1,
          blockTimestamp: mockRequest.event.blockTimestamp,
          transactionHash: 'requestTransactionHash',
        },
        { transaction: mockDbTransaction },
      );

      expect(DeadlineModel.findOrCreate).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
        lock: mockDbTransaction.LOCK.UPDATE,
        where: {
          accountId: 'deadline-account-id',
        },
        defaults: {
          accountId: 'deadline-account-id',
          receiverAccountId: 'receiver-account-id',
          receiverAccountType: 'project',
          claimableProjectId: 'repo-account-id',
          deadline: new Date(1704067200 * 1000),
          refundAccountId: 'refund-account-id',
          refundAccountType: 'address',
        },
      });
    });

    test('should update existing DeadlineModel when deadline already exists', async () => {
      // Arrange
      const accountSeenEvent = {
        accountId: 'deadline-account-id',
      };

      const existingDeadlineEntry = {
        accountId: 'deadline-account-id',
        receiverAccountId: 'old-receiver-account-id',
        receiverAccountType: 'old-type',
        claimableProjectId: 'old-repo-account-id',
        deadline: new Date(1234567890 * 1000),
        refundAccountId: 'old-refund-account-id',
        refundAccountType: 'old-refund-type',
        save: jest.fn().mockResolvedValue(undefined),
      };

      AccountSeenEventModel.create = jest
        .fn()
        .mockResolvedValue(accountSeenEvent);
      DeadlineModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([existingDeadlineEntry, false]);

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      expect(existingDeadlineEntry.receiverAccountId).toBe(
        'receiver-account-id',
      );
      expect(existingDeadlineEntry.receiverAccountType).toBe('project');
      expect(existingDeadlineEntry.claimableProjectId).toBe('repo-account-id');
      expect(existingDeadlineEntry.deadline).toEqual(
        new Date(1704067200 * 1000),
      );
      expect(existingDeadlineEntry.refundAccountId).toBe('refund-account-id');
      expect(existingDeadlineEntry.refundAccountType).toBe('address');
      expect(existingDeadlineEntry.save).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
      });
    });

    test('should return early if event is not the latest', async () => {
      // Arrange
      const accountSeenEvent = {
        accountId: 'deadline-account-id',
      };

      AccountSeenEventModel.create = jest
        .fn()
        .mockResolvedValue(accountSeenEvent);
      jest.mocked(isLatestEvent.isLatestEvent).mockResolvedValue(false);
      DeadlineModel.findOrCreate = jest.fn();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      expect(DeadlineModel.findOrCreate).not.toHaveBeenCalled();
      expect(ScopedLogger.prototype.flush).toHaveBeenCalled();
    });

    test('should call getAccountType for receiver and refund accounts', async () => {
      // Arrange
      const accountSeenEvent = {
        accountId: 'deadline-account-id',
      };

      AccountSeenEventModel.create = jest
        .fn()
        .mockResolvedValue(accountSeenEvent);
      DeadlineModel.findOrCreate = jest.fn().mockResolvedValue([{}, true]);

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      expect(getAccountType.getAccountType).toHaveBeenCalledWith(
        'receiver-account-id',
        mockDbTransaction,
      );
      expect(getAccountType.getAccountType).toHaveBeenCalledWith(
        'refund-account-id',
        mockDbTransaction,
      );
    });
  });
});
