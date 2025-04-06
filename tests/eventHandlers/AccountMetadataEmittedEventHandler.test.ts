/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import { AccountMetadataEmittedEventHandler } from '../../src/eventHandlers';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import type { EventData } from '../../src/events/types';
import { dbConnection } from '../../src/db/database';
import AccountMetadataEmittedEventModel from '../../src/models/AccountMetadataEmittedEventModel';
import { isLatestEvent } from '../../src/utils/isLatestEvent';
import { convertToAccountId } from '../../src/utils/accountIdUtils';
import { DRIPS_APP_USER_METADATA_KEY } from '../../src/core/constants';
import * as handleProjectMetadata from '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleProjectMetadata';
import { convertToIpfsHash } from '../../src/utils/metadataUtils';
import * as handleDripListMetadata from '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleDripListMetadata';

jest.mock('../../src/models/AccountMetadataEmittedEventModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/core/LogManager');
jest.mock('../../src/utils/eventUtils');
jest.mock(
  '../../src/eventHandlers/AccountMetadataEmittedEvent/gitProject/handleProjectMetadata',
);
jest.mock(
  '../../src/eventHandlers/AccountMetadataEmittedEvent/dripList/handleDripListMetadata',
);

describe('AccountMetadataEmittedHandler', () => {
  let mockDbTransaction: {};
  let handler: AccountMetadataEmittedEventHandler;
  let mockRequest: EventHandlerRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new AccountMetadataEmittedEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          80920745289880686872077472087501508459438916877610571750365932290048n,
          DRIPS_APP_USER_METADATA_KEY,
          '0x516d65444e625169575257666333395844754d354d69796337725755465156666b706d5a7675723965757767584a',
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should return if the metadata are not emitted by the Drips App', async () => {
      // Act
      await handler['_handle']({
        id: randomUUID(),
        event: {
          args: [
            80920745289880686872077472087501508459438916877610571750365932290048n,
            'key',
            'value',
          ],
          logIndex: 1,
          blockNumber: 1,
          blockTimestamp: new Date(),
          transactionHash: 'requestTransactionHash',
        } as EventData<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
      });

      // Assert
      expect(dbConnection.transaction).not.toHaveBeenCalled();
    });

    test('should create a new AccountMetadataEmittedEventModel', async () => {
      // Arrange
      AccountMetadataEmittedEventModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([
          {
            transactionHash: 'AccountMetadataEmittedEventTransactionHash',
            logIndex: 1,
          },
          true,
        ]);

      (isLatestEvent as jest.Mock).mockResolvedValue(false);

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          args: [accountId, key, value],
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      } = mockRequest;

      expect(
        AccountMetadataEmittedEventModel.findOrCreate,
      ).toHaveBeenCalledWith({
        lock: true,
        transaction: mockDbTransaction,
        where: {
          logIndex,
          transactionHash,
        },
        defaults: {
          key,
          value,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          accountId: convertToAccountId(accountId),
        },
      });
    });

    test('should handle Project metadata when metadata are coming from a Project and the incoming event is the latest', async () => {
      // Arrange
      AccountMetadataEmittedEventModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([
          {
            transactionHash: 'AccountMetadataEmittedEventTransactionHash',
            logIndex: 1,
          },
          true,
        ]);

      (isLatestEvent as jest.Mock).mockResolvedValue(true);

      (handleProjectMetadata.default as jest.Mock) = jest.fn();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      expect(handleProjectMetadata.default).toHaveBeenCalledWith(
        expect.anything(),
        convertToAccountId(mockRequest.event.args[0]),
        mockDbTransaction,
        convertToIpfsHash(mockRequest.event.args[2]),
        mockRequest.event.blockTimestamp,
      );
    });

    test('should handle Drip List metadata when metadata are coming from a Drip List and the incoming event is the latest', async () => {
      // Arrange
      AccountMetadataEmittedEventModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([
          {
            transactionHash: 'AccountMetadataEmittedEventTransactionHash',
            logIndex: 1,
          },
          true,
        ]);

      (isLatestEvent as jest.Mock).mockResolvedValue(true);

      (handleDripListMetadata.default as jest.Mock) = jest.fn();

      const request = {
        id: randomUUID(),
        event: {
          args: [
            42090747530143187925772296541596488845753594998762284015257144913834n,
            DRIPS_APP_USER_METADATA_KEY,
            '0x516d647379466476796f35484b554d4158795478737163786d795a6f3233556e31764e52786b3331707176587571',
          ],
          logIndex: 1,
          blockNumber: 1,
          blockTimestamp: new Date(),
          transactionHash: 'requestTransactionHash',
        } as EventData<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
      };

      // Act
      await new AccountMetadataEmittedEventHandler()['_handle'](request);

      // Assert
      expect(handleDripListMetadata.default).toHaveBeenCalledWith({
        logManager: expect.anything(),
        dripListId: convertToAccountId(request.event.args[0]),
        transaction: mockDbTransaction,
        ipfsHash: convertToIpfsHash(request.event.args[2]),
        blockTimestamp: request.event.blockTimestamp,
        blockNumber: 1,
        metadata: expect.anything(),
      });
    });
  });
});
