/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import StreamReceiverSeenEventModel from '../../src/models/StreamReceiverSeenEventModel';
import LogManager from '../../src/core/LogManager';
import { toAccountId } from '../../src/utils/accountIdUtils';
import { StreamReceiverSeenEventHandler } from '../../src/eventHandlers';
import { toBigIntString } from '../../src/utils/bigintUtils';

jest.mock('../../src/models/StreamReceiverSeenEventModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/core/LogManager');

describe('StreamReceiverSeenEventHandler', () => {
  let mockDbTransaction: {};
  let handler: StreamReceiverSeenEventHandler;
  let mockRequest: EventHandlerRequest<'StreamReceiverSeen(bytes32,uint256,uint256)'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new StreamReceiverSeenEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          'receiversHash',
          80920745289880686872077472087501508459438916877610571750365932290048n,
          2342312n,
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'StreamReceiverSeen(bytes32,uint256,uint256)'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create a new StreamReceiverSeenEventModel', async () => {
      // Arrange
      StreamReceiverSeenEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'StreamReceiverSeenTransactionHash',
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
          args: [rawReceiversHash, rawAccountId, rawConfig],
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      } = mockRequest;

      expect(StreamReceiverSeenEventModel.findOrCreate).toHaveBeenCalledWith({
        lock: true,
        transaction: mockDbTransaction,
        where: {
          logIndex,
          transactionHash,
        },
        defaults: {
          accountId: toAccountId(rawAccountId),
          receiversHash: rawReceiversHash,
          config: toBigIntString(rawConfig.toString()),
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      });
    });
  });
});
