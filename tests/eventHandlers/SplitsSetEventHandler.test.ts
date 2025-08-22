/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import SplitsSetEventModel from '../../src/models/SplitsSetEventModel';
import * as accountIdUtils from '../../src/utils/accountIdUtils';
import SplitsSetEventHandler from '../../src/eventHandlers/SplitsSetEvent/SplitsSetEventHandler';
import ScopedLogger from '../../src/core/ScopedLogger';
import setIsValidFlag from '../../src/eventHandlers/SplitsSetEvent/setIsValidFlag';
import { processLinkedIdentitySplits } from '../../src/eventHandlers/SplitsSetEvent/processLinkedIdentitySplits';
import type { AccountId } from '../../src/core/types';

jest.mock('../../src/models/SplitsSetEventModel');
jest.mock('../../src/models/LinkedIdentityModel');
jest.mock('../../src/db/database');
jest.mock('../../src/utils/validateLinkedIdentity');
jest.mock('bee-queue');
jest.mock('../../src/core/ScopedLogger');
jest.mock('../../src/eventHandlers/SplitsSetEvent/setIsValidFlag');
jest.mock('../../src/eventHandlers/SplitsSetEvent/processLinkedIdentitySplits');
jest.mock('../../src/utils/accountIdUtils');

describe('SplitsSetEventHandler', () => {
  let mockDbTransaction: {};
  let handler: SplitsSetEventHandler;
  let mockRequest: EventHandlerRequest<'SplitsSet(uint256,bytes32)'>;

  beforeEach(() => {
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

    mockDbTransaction = {
      LOCK: {
        UPDATE: 'UPDATE',
      },
    };

    jest
      .mocked(accountIdUtils.convertToAccountId)
      .mockReturnValue(mockRequest.event.args[0] as AccountId);

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create a new SplitsSetEventModel', async () => {
      // Arrange
      SplitsSetEventModel.create = jest.fn().mockResolvedValue([
        {
          transactionHash: 'SplitsSetTransactionHash',
          logIndex: 1,
        },
      ]);

      ScopedLogger.prototype.bufferCreation = jest.fn().mockReturnThis();

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

      expect(SplitsSetEventModel.create).toHaveBeenCalledWith(
        {
          accountId: accountIdUtils.convertToAccountId(rawAccountId),
          receiversHash: rawReceiversHash,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
        {
          transaction: mockDbTransaction,
        },
      );

      expect(setIsValidFlag).toHaveBeenCalled();
    });

    test('should set isLinked flag for ORCID account', async () => {
      // Arrange
      const orcidAccountId =
        '81320912658542974439730181977206773330805723773165208113981035642880'; // ORCID account
      const mockOrcidRequest = {
        ...mockRequest,
        event: {
          ...mockRequest.event,
          args: [BigInt(orcidAccountId), 'receiversHash'],
        },
      };

      jest.mocked(accountIdUtils.isOrcidAccount).mockReturnValue(true);

      const splitsSetEvent = {
        transactionHash: 'SplitsSetTransactionHash',
        logIndex: 1,
      };

      SplitsSetEventModel.create = jest.fn().mockResolvedValue(splitsSetEvent);

      // Act
      await handler['_handle'](mockOrcidRequest);

      // Assert
      expect(processLinkedIdentitySplits).toHaveBeenCalledWith(
        splitsSetEvent,
        expect.any(ScopedLogger),
        mockDbTransaction,
      );
    });

    test('should set isValid flag for Project account', async () => {
      // Arrange
      const projectAccountId =
        '81320912658542974439730181977206773330805723773165208113981035642880'; // ORCID account
      const mockOrcidRequest = {
        ...mockRequest,
        event: {
          ...mockRequest.event,
          args: [BigInt(projectAccountId), 'receiversHash'],
        },
      };

      jest.mocked(accountIdUtils.isOrcidAccount).mockReturnValue(false);

      const splitsSetEvent = {
        transactionHash: 'SplitsSetTransactionHash',
        logIndex: 1,
      };

      SplitsSetEventModel.create = jest.fn().mockResolvedValue(splitsSetEvent);

      // Act
      await handler['_handle'](mockOrcidRequest);

      // Assert
      expect(setIsValidFlag).toHaveBeenCalledWith(
        splitsSetEvent,
        expect.any(ScopedLogger),
        mockDbTransaction,
      );
    });
  });
});
