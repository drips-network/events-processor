/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import { hexlify, toUtf8Bytes } from 'ethers';
import { AccountMetadataEmittedEventHandler } from '../../src/eventHandlers';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import type { EventData } from '../../src/events/types';
import { dbConnection } from '../../src/db/database';
import AccountMetadataEmittedEventModel from '../../src/models/AccountMetadataEmittedEventModel';
import { convertToAccountId } from '../../src/utils/accountIdUtils';
import { DRIPS_APP_USER_METADATA_KEY } from '../../src/core/constants';
import * as handleProjectMetadata from '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleProjectMetadata';
import {
  convertToIpfsHash,
  getNftDriverMetadata,
} from '../../src/utils/metadataUtils';
import * as handleDripListMetadata from '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleDripListMetadata';
import * as handleEcosystemMainAccountMetadata from '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleEcosystemMainAccountMetadata';
import * as handleSubListMetadata from '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleSubListMetadata';

jest.mock('../../src/models/AccountMetadataEmittedEventModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/core/ScopedLogger');
jest.mock('../../src/events/eventHandlerUtils');
jest.mock(
  '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleProjectMetadata',
);
jest.mock(
  '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleDripListMetadata',
);
jest.mock(
  '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleEcosystemMainAccountMetadata',
);
jest.mock(
  '../../src/eventHandlers/AccountMetadataEmittedEvent/handlers/handleSubListMetadata',
);
jest.mock('../../src/utils/metadataUtils');

describe('AccountMetadataEmittedHandler', () => {
  let mockDbTransaction: {};
  let handler: AccountMetadataEmittedEventHandler;
  let mockRequest: EventHandlerRequest<'AccountMetadataEmitted(uint256,bytes32,bytes)'>;

  beforeEach(() => {
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

    (convertToIpfsHash as jest.Mock).mockReturnValue('ipfsHash');

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
            hexlify(toUtf8Bytes('key')),
            '0x516d65444e625169575257666333395844754d354d69796337725755465156666b706d5a7675723965757767584a',
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

    test('should return if the metadata are not emitted by a supported Driver', async () => {
      // Arrange
      let transactionCallbackExecuted = false;
      AccountMetadataEmittedEventModel.create = jest.fn().mockResolvedValue({
        transactionHash: 'AccountMetadataEmittedEventTransactionHash',
        logIndex: 1,
      });

      dbConnection.transaction = jest
        .fn()
        .mockImplementation(async (callback) => {
          await callback(mockDbTransaction);
          transactionCallbackExecuted = true;
        });

      // Act
      await handler['_handle']({
        id: randomUUID(),
        event: {
          args: [
            1n,
            DRIPS_APP_USER_METADATA_KEY,
            '0x516d65444e625169575257666333395844754d354d69796337725755465156666b706d5a7675723965757767584a',
          ],
          logIndex: 1,
          blockNumber: 1,
          blockTimestamp: new Date(),
          transactionHash: 'requestTransactionHash',
        } as EventData<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
      });

      // Assert
      expect(dbConnection.transaction).toHaveBeenCalled();
      expect(transactionCallbackExecuted).toBe(true);
      expect(handleProjectMetadata.default).not.toHaveBeenCalled();
      expect(handleDripListMetadata.default).not.toHaveBeenCalled();
      expect(handleEcosystemMainAccountMetadata.default).not.toHaveBeenCalled();
      expect(handleSubListMetadata.default).not.toHaveBeenCalled();
    });

    test('should create a new AccountMetadataEmittedEvent', async () => {
      // Arrange
      AccountMetadataEmittedEventModel.create = jest.fn().mockResolvedValue([
        {
          transactionHash: 'AccountMetadataEmittedEventTransactionHash',
          logIndex: 1,
        },
      ]);

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

      expect(AccountMetadataEmittedEventModel.create).toHaveBeenCalledWith(
        {
          key,
          value,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          accountId: convertToAccountId(accountId),
        },
        {
          transaction: mockDbTransaction,
        },
      );
    });

    test('should handle Project metadata when metadata are coming from a Project and the incoming event is the latest', async () => {
      // Arrange
      AccountMetadataEmittedEventModel.create = jest.fn().mockResolvedValue([
        {
          transactionHash: 'AccountMetadataEmittedEventTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

      (handleProjectMetadata.default as jest.Mock) = jest.fn();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      expect(handleProjectMetadata.default).toHaveBeenCalledWith({
        logIndex: mockRequest.event.logIndex,
        ipfsHash: convertToIpfsHash(mockRequest.event.args[2]),
        blockNumber: mockRequest.event.blockNumber,
        scopedLogger: expect.anything(),
        emitterAccountId: convertToAccountId(mockRequest.event.args[0]),
        transaction: mockDbTransaction,
        blockTimestamp: mockRequest.event.blockTimestamp,
      });
    });

    test('should handle Drip List metadata when metadata are coming from a Drip List and the incoming event is the latest', async () => {
      // Arrange
      AccountMetadataEmittedEventModel.create = jest.fn().mockResolvedValue([
        {
          transactionHash: 'AccountMetadataEmittedEventTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

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

      const mockMetadata = {
        type: 'dripList',
      };
      (getNftDriverMetadata as jest.Mock).mockResolvedValue(mockMetadata);

      // Act
      await new AccountMetadataEmittedEventHandler()['_handle'](request);

      // Assert
      expect(handleDripListMetadata.default).toHaveBeenCalledWith({
        ipfsHash: convertToIpfsHash(request.event.args[2]),
        metadata: mockMetadata,
        scopedLogger: expect.anything(),
        logIndex: request.event.logIndex,
        transaction: mockDbTransaction,
        blockTimestamp: request.event.blockTimestamp,
        blockNumber: request.event.blockNumber,
        emitterAccountId: convertToAccountId(request.event.args[0]),
      });
    });

    test('should skip processing when ORCID account emits metadata', async () => {
      // Arrange
      const orcidAccountId =
        81301089168126148130792717371793573750187013649223913888328074657793n;

      const orcidRequest = {
        id: randomUUID(),
        event: {
          args: [
            orcidAccountId,
            DRIPS_APP_USER_METADATA_KEY,
            '0x516d65444e625169575257666333395844754d354d69796337725755465156666b706d5a7675723965757767584a',
          ],
          logIndex: 1,
          blockNumber: 1,
          blockTimestamp: new Date(),
          transactionHash: 'requestTransactionHash',
        } as EventData<'AccountMetadataEmitted(uint256,bytes32,bytes)'>,
      };

      AccountMetadataEmittedEventModel.create = jest.fn().mockResolvedValue([
        {
          transactionHash: 'AccountMetadataEmittedEventTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

      // Act
      await handler['_handle'](orcidRequest);

      // Assert
      expect(handleProjectMetadata.default).not.toHaveBeenCalled();
      expect(handleDripListMetadata.default).not.toHaveBeenCalled();
      expect(handleEcosystemMainAccountMetadata.default).not.toHaveBeenCalled();
      expect(handleSubListMetadata.default).not.toHaveBeenCalled();
    });
  });
});
