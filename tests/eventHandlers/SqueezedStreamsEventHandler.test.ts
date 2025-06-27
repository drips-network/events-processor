/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import SqueezedStreamsEventModel from '../../src/models/SqueezedStreamsEventModel';
import ScopedLogger from '../../src/core/ScopedLogger';
import SqueezedStreamsEventHandler from '../../src/eventHandlers/SqueezedStreamsEventHandler';
import { convertToAccountId } from '../../src/utils/accountIdUtils';
import { toAddress } from '../../src/utils/ethereumAddressUtils';
import { toBigIntString } from '../../src/utils/bigintUtils';

jest.mock('../../src/models/SqueezedStreamsEventModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/core/ScopedLogger');

describe('SqueezedStreamsEventHandler', () => {
  let mockDbTransaction: {};
  let handler: SqueezedStreamsEventHandler;
  let mockRequest: EventHandlerRequest<'SqueezedStreams(uint256,address,uint256,uint128,bytes32[])'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new SqueezedStreamsEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          80920745289880686872077472087501508459438916877610571750365932290048n,
          '0x20a9273a452268E5a034951ae5381a45E14aC2a3',
          80920745289880686872077472087501508459438916877610571750365932290048n,
          1n,
          ['0x20a9273a452268E5a034951ae5381a45E14aC2a3'],
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'SqueezedStreams(uint256,address,uint256,uint128,bytes32[])'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create a new SqueezedStreamsEventModel', async () => {
      // Arrange
      SqueezedStreamsEventModel.create = jest.fn().mockResolvedValue([
        {
          transactionHash: 'SqueezedStreamsTransactionHash',
          logIndex: 1,
        },
      ]);

      ScopedLogger.prototype.bufferCreation = jest.fn().mockReturnThis();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          args: [
            rawAccountId,
            rawErc20,
            rawSenderId,
            rawAmt,
            rawStreamsHistoryHashes,
          ],
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      } = mockRequest;

      expect(SqueezedStreamsEventModel.create).toHaveBeenCalledWith(
        {
          accountId: convertToAccountId(rawAccountId),
          erc20: toAddress(rawErc20),
          senderId: convertToAccountId(rawSenderId),
          amount: toBigIntString(rawAmt.toString()),
          streamsHistoryHashes: SqueezedStreamsEventModel.toStreamHistoryHashes(
            rawStreamsHistoryHashes,
          ),
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
        {
          transaction: mockDbTransaction,
        },
      );
    });
  });
});
