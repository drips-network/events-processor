/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { OwnerUpdatedEventHandler } from '../../src/eventHandlers';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import {
  getOwnerAccountId,
  toRepoDriverId,
} from '../../src/utils/accountIdUtils';
import { calculateProjectStatus } from '../../src/utils/gitProjectUtils';
import OwnerUpdatedEventModel from '../../src/models/OwnerUpdatedEventModel';
import GitProjectModel, {
  ProjectVerificationStatus,
} from '../../src/models/GitProjectModel';
import LogManager from '../../src/core/LogManager';
import { isLatestEvent } from '../../src/utils/eventUtils';

jest.mock('../../src/models/OwnerUpdatedEventModel');
jest.mock('../../src/models/GitProjectModel');
jest.mock('../../src/utils/dripListUtils');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/utils/eventUtils');
jest.mock('../../src/core/LogManager');
jest.mock('../../src/utils/accountIdUtils');

describe('OwnerUpdatedEventHandler', () => {
  let mockDbTransaction: {};
  let handler: OwnerUpdatedEventHandler;
  let mockRequest: EventHandlerRequest<'OwnerUpdated(uint256,address)'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new OwnerUpdatedEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          80920745289880686872077472087501508459438916877610571750365932290048n,
          '0x20a9273a452268E5a034951ae5381a45E14aC2a3',
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'OwnerUpdated(uint256,address)'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create new OwnerUpdatedEventModel and GitProjectModel', async () => {
      // Arrange
      OwnerUpdatedEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'OwnerUpdatedEventTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

      (toRepoDriverId as jest.Mock).mockReturnValue('1');

      GitProjectModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          id: toRepoDriverId(mockRequest.event.args[0]),
        },
        true,
      ]);

      LogManager.prototype.appendFindOrCreateLog = jest.fn().mockReturnThis();

      (getOwnerAccountId as jest.Mock).mockResolvedValue('ownerAccountId');

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          args: [accountId, owner],
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      } = mockRequest;

      expect(OwnerUpdatedEventModel.findOrCreate).toHaveBeenCalledWith({
        lock: true,
        transaction: mockDbTransaction,
        where: {
          logIndex,
          transactionHash,
        },
        defaults: {
          owner,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          accountId: toRepoDriverId(accountId),
        },
      });

      expect(GitProjectModel.findOrCreate).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
        lock: true,
        where: {
          id: toRepoDriverId(accountId),
        },
        defaults: {
          id: toRepoDriverId(accountId),
          isValid: true,
          ownerAddress: owner,
          claimedAt: blockTimestamp,
          ownerAccountId: await getOwnerAccountId(owner),
          verificationStatus: ProjectVerificationStatus.OwnerUpdated,
        },
      });
    });

    test('should update the GitProjectModel when the incoming event is the latest', async () => {
      // Arrange
      OwnerUpdatedEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'OwnerUpdatedEventTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

      const mockGitProject = {
        ownerAddress: '',
        ownerAccountId: '',
        verificationStatus: ProjectVerificationStatus.Unclaimed,
        save: jest.fn(),
      };
      GitProjectModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([mockGitProject, false]);

      (isLatestEvent as jest.Mock).mockResolvedValue(true);

      LogManager.prototype.appendIsLatestEventLog = jest.fn().mockReturnThis();

      (getOwnerAccountId as jest.Mock).mockResolvedValue('ownerAccountId');

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
          args: [accountId, owner],
        },
      } = mockRequest;

      expect(mockGitProject.ownerAddress).toBe(owner);
      expect(mockGitProject.ownerAccountId).toBe(
        await getOwnerAccountId(owner),
      );
      expect(mockGitProject.verificationStatus).toBe(
        calculateProjectStatus(mockGitProject as any),
      );
      expect(mockGitProject.save).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
      });
    });
  });
});
