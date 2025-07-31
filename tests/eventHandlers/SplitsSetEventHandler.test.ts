/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import SplitsSetEventModel from '../../src/models/SplitsSetEventModel';
import { LinkedIdentityModel } from '../../src/models';
import { convertToAccountId } from '../../src/utils/accountIdUtils';
import { validateLinkedIdentity } from '../../src/utils/validateLinkedIdentity';
import SplitsSetEventHandler from '../../src/eventHandlers/SplitsSetEvent/SplitsSetEventHandler';
import ScopedLogger from '../../src/core/ScopedLogger';
import setIsValidFlag from '../../src/eventHandlers/SplitsSetEvent/setIsValidFlag';

jest.mock('../../src/models/SplitsSetEventModel');
jest.mock('../../src/models/LinkedIdentityModel');
jest.mock('../../src/db/database');
jest.mock('../../src/utils/validateLinkedIdentity');
jest.mock('bee-queue');
jest.mock('../../src/core/ScopedLogger');
jest.mock('../../src/eventHandlers/SplitsSetEvent/setIsValidFlag');

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
          accountId: convertToAccountId(rawAccountId),
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

    test('should update isLinked flag for ORCID account when splits are valid', async () => {
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

      const mockLinkedIdentity = {
        accountId: orcidAccountId,
        ownerAccountId: '123456789',
        isLinked: false,
        save: jest.fn(),
      };

      (LinkedIdentityModel as any).findOne = jest
        .fn()
        .mockResolvedValue(mockLinkedIdentity);
      (validateLinkedIdentity as jest.Mock).mockResolvedValue(true);

      // Act
      await handler['_handle'](mockOrcidRequest);

      // Assert
      expect(LinkedIdentityModel.findOne).toHaveBeenCalledWith({
        where: { accountId: orcidAccountId },
        transaction: mockDbTransaction,
        lock: (mockDbTransaction as any).LOCK.UPDATE,
      });
      expect(validateLinkedIdentity).toHaveBeenCalledWith(
        orcidAccountId,
        '123456789',
      );
      expect(mockLinkedIdentity.isLinked).toBe(true);
      expect(mockLinkedIdentity.save).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
      });
    });

    test('should update isLinked flag to false for ORCID account when splits are invalid', async () => {
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

      const mockLinkedIdentity = {
        accountId: orcidAccountId,
        ownerAccountId: '123456789',
        isLinked: true,
        save: jest.fn(),
      };

      (LinkedIdentityModel as any).findOne = jest
        .fn()
        .mockResolvedValue(mockLinkedIdentity);
      (validateLinkedIdentity as jest.Mock).mockResolvedValue(false);

      // Act
      await handler['_handle'](mockOrcidRequest);

      // Assert
      expect(mockLinkedIdentity.isLinked).toBe(false);
      expect(mockLinkedIdentity.save).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
      });
    });

    test('should skip isLinked update for non-ORCID account', async () => {
      // Arrange - using the default mockRequest which is a non-ORCID account
      (LinkedIdentityModel as any).findOne = jest.fn().mockResolvedValue(null);

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      expect(LinkedIdentityModel.findOne).not.toHaveBeenCalled();
      expect(validateLinkedIdentity).not.toHaveBeenCalled();
    });

    test('should skip isLinked update when LinkedIdentity not found', async () => {
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

      (LinkedIdentityModel as any).findOne = jest.fn().mockResolvedValue(null);

      // Act
      await handler['_handle'](mockOrcidRequest);

      // Assert
      expect(LinkedIdentityModel.findOne).toHaveBeenCalled();
      expect(validateLinkedIdentity).not.toHaveBeenCalled();
    });
  });
});
