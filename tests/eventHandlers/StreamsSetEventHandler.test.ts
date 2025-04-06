/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import StreamsSetEventModel from '../../src/models/StreamsSetEventModel';
import LogManager from '../../src/core/LogManager';
import { convertToAccountId } from '../../src/utils/accountIdUtils';
import { StreamsSetEventHandler } from '../../src/eventHandlers';
import { toBigIntString } from '../../src/utils/bigintUtils';

jest.mock('../../src/models/StreamsSetEventModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/core/LogManager');

describe('StreamsSetEventHandler', () => {
  let mockDbTransaction: {};
  let handler: StreamsSetEventHandler;
  let mockRequest: EventHandlerRequest<'StreamsSet(uint256,address,bytes32,bytes32,uint128,uint32)'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new StreamsSetEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          80920745289880686872077472087501508459438916877610571750365932290048n,
          '0x20a9273a452268E5a034951ae5381a45E14aC2a3',
          'receiversHash',
          'streamsHistoryHash',
          2342312n,
          23432n,
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'StreamsSet(uint256,address,bytes32,bytes32,uint128,uint32)'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create a new StreamsSetEventModel', async () => {
      // Arrange
      StreamsSetEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'StreamsSetTransactionHash',
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
          args: [
            rawAccountId,
            rawErc20,
            rawReceiversHash,
            rawStreamsHistoryHash,
            rawBalance,
            rawMaxEnd,
          ],
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      } = mockRequest;

      expect(StreamsSetEventModel.findOrCreate).toHaveBeenCalledWith({
        lock: true,
        transaction: mockDbTransaction,
        where: {
          logIndex,
          transactionHash,
        },
        defaults: {
          accountId: convertToAccountId(rawAccountId),
          erc20: rawErc20,
          receiversHash: rawReceiversHash,
          streamsHistoryHash: rawStreamsHistoryHash,
          balance: toBigIntString(rawBalance.toString()),
          maxEnd: toBigIntString(rawMaxEnd.toString()),
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      });
    });
  });
});
