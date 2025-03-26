/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import CreatedSplitsEventModel from '../../src/models/CreatedSplitsEventModel';
import LogManager from '../../src/core/LogManager';
import { toAccountId } from '../../src/utils/accountIdUtils';
import { CreatedSplitsEventHandler } from '../../src/eventHandlers';
import SubListModel from '../../src/models/SubListModel';

jest.mock('../../src/models/CreatedSplitsEventModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/core/LogManager');

describe('CreatedSplitsEventHandler', () => {
  let mockDbTransaction: {};
  let handler: CreatedSplitsEventHandler;
  let mockRequest: EventHandlerRequest<'CreatedSplits(uint256,bytes32)'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new CreatedSplitsEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          53919893334301279589334030174039261347274288845081144962207220498533n,
          'receiversHash',
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'CreatedSplits(uint256,bytes32)'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create a new CreatedSplitsEventModel', async () => {
      // Arrange
      CreatedSplitsEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'CreatedSplitsTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

      const mockSubList = {
        ownerAddress: '',
        previousOwnerAddress: '',
        ownerAccountId: '',
        save: jest.fn(),
      };
      SubListModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([mockSubList, true]);

      LogManager.prototype.appendFindOrCreateLog = jest.fn().mockReturnThis();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          args: [rawAccountId, rawReceiversHash],
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      } = mockRequest;

      expect(CreatedSplitsEventModel.findOrCreate).toHaveBeenCalledWith({
        lock: true,
        transaction: mockDbTransaction,
        where: {
          logIndex,
          transactionHash,
        },
        defaults: {
          accountId: toAccountId(rawAccountId),
          receiversHash: rawReceiversHash,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      });
    });
  });
});
