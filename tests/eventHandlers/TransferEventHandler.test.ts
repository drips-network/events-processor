/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { TransferEventHandler } from '../../src/eventHandlers';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import { calcAccountId, toNftDriverId } from '../../src/utils/accountIdUtils';
import { isLatestEvent } from '../../src/utils/eventUtils';
import LogManager from '../../src/core/LogManager';
import TransferEventModel from '../../src/models/TransferEventModel';
import DripListModel from '../../src/models/DripListModel';

jest.mock('../../src/models/TransferEventModel');
jest.mock('../../src/models/DripListModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/utils/eventUtils');
jest.mock('../../src/utils/accountIdUtils');
jest.mock('../../src/core/LogManager');

describe('TransferEventHandler', () => {
  let mockDbTransaction: {};
  let handler: TransferEventHandler;
  let mockRequest: EventHandlerRequest<'Transfer(address,address,uint256)'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new TransferEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          'from',
          'to',
          27499230360500278592906888216175021054496828202459358979161455437419n,
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'Transfer(address,address,uint256)'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create a new TransferEventModel', async () => {
      // Arrange
      TransferEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'TransferEventTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

      DripListModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([{ save: jest.fn() }, true]);

      LogManager.prototype.appendFindOrCreateLog = jest.fn().mockReturnThis();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          args: [from, to, tokenId],
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      } = mockRequest;

      expect(TransferEventModel.findOrCreate).toHaveBeenCalledWith({
        lock: true,
        transaction: mockDbTransaction,
        where: {
          logIndex,
          transactionHash,
        },
        defaults: {
          tokenId: toNftDriverId(tokenId),
          to,
          from,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      });
    });

    test('should create a new DripListModel when the token is representing a Drip List', async () => {
      // Arrange
      TransferEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'TransferEventTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

      (calcAccountId as jest.Mock).mockResolvedValue('ownerAccountId');

      DripListModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([{ save: jest.fn() }, true]);

      LogManager.prototype.appendFindOrCreateLog = jest.fn().mockReturnThis();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          args: [from, to, tokenId],
        },
      } = mockRequest;

      expect(DripListModel.findOrCreate).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
        lock: true,
        where: {
          id: toNftDriverId(tokenId),
        },
        defaults: {
          id: toNftDriverId(tokenId),
          creator: to,
          isValid: true,
          ownerAddress: to,
          ownerAccountId: 'ownerAccountId',
          previousOwnerAddress: from,
        },
      });
    });

    test('should update the DripListModel when the incoming event is the latest', async () => {
      // Arrange
      TransferEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'TransferEventTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

      (calcAccountId as jest.Mock).mockResolvedValue('ownerAccountId');

      const mockDripList = {
        ownerAddress: '',
        previousOwnerAddress: '',
        ownerAccountId: '',
        save: jest.fn(),
      };
      DripListModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([mockDripList, false]);

      (isLatestEvent as jest.Mock).mockResolvedValue(true);

      LogManager.prototype.appendIsLatestEventLog = jest.fn().mockReturnThis();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          args: [from, to],
        },
      } = mockRequest;

      expect(mockDripList.ownerAddress).toBe(to);
      expect(mockDripList.previousOwnerAddress).toBe(from);
      expect(mockDripList.ownerAccountId).toBe('ownerAccountId');
      expect(mockDripList.save).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
      });
    });
  });
});
