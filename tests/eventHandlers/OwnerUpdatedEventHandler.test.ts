/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { OwnerUpdatedEventHandler } from '../../src/eventHandlers';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import {
  calcAccountId,
  convertToRepoDriverId,
} from '../../src/utils/accountIdUtils';
import { calculateProjectStatus } from '../../src/utils/projectUtils';
import OwnerUpdatedEventModel from '../../src/models/OwnerUpdatedEventModel';
import ProjectModel, {
  ProjectVerificationStatus,
} from '../../src/models/ProjectModel';
import LogManager from '../../src/core/LogManager';
import { isLatestEvent } from '../../src/utils/isLatestEvent';

jest.mock('../../src/models/OwnerUpdatedEventModel');
jest.mock('../../src/models/ProjectModel');
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
    test('should create new OwnerUpdatedEventModel and ProjectModel', async () => {
      // Arrange
      OwnerUpdatedEventModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          transactionHash: 'OwnerUpdatedEventTransactionHash',
          logIndex: 1,
        },
        true,
      ]);

      (convertToRepoDriverId as jest.Mock).mockReturnValue('1');

      ProjectModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          id: convertToRepoDriverId(mockRequest.event.args[0]),
        },
        true,
      ]);

      LogManager.prototype.appendFindOrCreateLog = jest.fn().mockReturnThis();

      (calcAccountId as jest.Mock).mockResolvedValue('ownerAccountId');

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
          accountId: convertToRepoDriverId(accountId),
        },
      });

      expect(ProjectModel.findOrCreate).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
        lock: true,
        where: {
          id: convertToRepoDriverId(accountId),
        },
        defaults: {
          id: convertToRepoDriverId(accountId),
          isValid: true,
          isVisible: true,
          ownerAddress: owner,
          claimedAt: blockTimestamp,
          ownerAccountId: await calcAccountId(owner),
          verificationStatus: ProjectVerificationStatus.OwnerUpdated,
        },
      });
    });

    test('should update the ProjectModel when the incoming event is the latest', async () => {
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
      ProjectModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([mockGitProject, false]);

      (isLatestEvent as jest.Mock).mockResolvedValue(true);

      (calcAccountId as jest.Mock).mockResolvedValue('ownerAccountId');

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
      expect(mockGitProject.ownerAccountId).toBe(await calcAccountId(owner));
      expect(mockGitProject.verificationStatus).toBe(
        calculateProjectStatus(mockGitProject as any),
      );
      expect(mockGitProject.save).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
      });
    });
  });
});
