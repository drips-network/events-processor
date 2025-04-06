/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import SplitEventModel from '../../src/models/SplitEventModel';
import LogManager from '../../src/core/LogManager';
import SplitEventHandler from '../../src/eventHandlers/SplitEventHandler';
import { convertToAccountId } from '../../src/utils/accountIdUtils';
import { toAddress } from '../../src/utils/ethereumAddressUtils';
import { toBigIntString } from '../../src/utils/bigintUtils';

jest.mock('../../src/models/SplitEventModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/core/LogManager');

describe('SplitEventHandler', () => {
  let mockDbTransaction: {};
  let handler: SplitEventHandler;
  let mockRequest: EventHandlerRequest<'Split(uint256,uint256,address,uint128)'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new SplitEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          80920745289880686872077472087501508459438916877610571750365932290048n,
          80920745289880686872077472087501508459438916877610571750365932290048n,
          '0x20a9273a452268E5a034951ae5381a45E14aC2a3',
          5n,
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'Split(uint256,uint256,address,uint128)'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create a new SplitEventModel', async () => {
      // Arrange
      SplitEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'SplitEventTransactionHash',
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
          args: [rawAccountId, rawReceiver, rawErc20, rawAmt],
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      } = mockRequest;

      expect(SplitEventModel.findOrCreate).toHaveBeenCalledWith({
        lock: true,
        transaction: mockDbTransaction,
        where: {
          logIndex,
          transactionHash,
        },
        defaults: {
          accountId: convertToAccountId(rawAccountId),
          receiver: convertToAccountId(rawReceiver),
          erc20: toAddress(rawErc20),
          amt: toBigIntString(rawAmt.toString()),
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      });
    });
  });
});
