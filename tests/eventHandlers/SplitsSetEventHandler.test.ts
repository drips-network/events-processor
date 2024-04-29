/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import SplitsSetEventModel from '../../src/models/SplitsSetEventModel';
import LogManager from '../../src/core/LogManager';
import { toAccountId } from '../../src/utils/accountIdUtils';
import { SplitsSetEventHandler } from '../../src/eventHandlers';
import setIsValidFlag from '../../src/eventHandlers/SplitsSetEventHandler/setIsValidFlag';

jest.mock('../../src/models/SplitsSetEventModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/core/LogManager');
jest.mock('../../src/eventHandlers/SplitsSetEventHandler/setIsValidFlag');

describe('SplitsSetEventHandler', () => {
  let mockDbTransaction: {};
  let handler: SplitsSetEventHandler;
  let mockRequest: EventHandlerRequest<'SplitsSet(uint256,bytes32)'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new SplitsSetEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          80920745289880686872077472087501508459438916877610571750365932290048n,
          'receiversHash',
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'SplitsSet(uint256,bytes32)'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create a new SplitsSetEventModel', async () => {
      // Arrange
      SplitsSetEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'SplitsSetTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

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

      expect(SplitsSetEventModel.findOrCreate).toHaveBeenCalledWith({
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

      expect(setIsValidFlag).toHaveBeenCalled();
    });
  });
});
