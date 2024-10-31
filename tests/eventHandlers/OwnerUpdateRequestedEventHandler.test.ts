/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { OwnerUpdateRequestedEventHandler } from '../../src/eventHandlers';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import { toRepoDriverId } from '../../src/utils/accountIdUtils';
import {
  calculateProjectStatus,
  toForge,
  toReadable,
  toUrl,
} from '../../src/utils/gitProjectUtils';
import OwnerUpdateRequestedEventModel from '../../src/models/OwnerUpdateRequestedEventModel';
import GitProjectModel, {
  ProjectVerificationStatus,
} from '../../src/models/GitProjectModel';
import LogManager from '../../src/core/LogManager';
import { isLatestEvent } from '../../src/utils/eventUtils';

jest.mock('../../src/models/OwnerUpdateRequestedEventModel');
jest.mock('../../src/models/GitProjectModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/utils/eventUtils');
jest.mock('../../src/core/LogManager');

describe('OwnerUpdateRequestedEventHandler', () => {
  let mockDbTransaction: {};
  let handler: OwnerUpdateRequestedEventHandler;
  let mockRequest: EventHandlerRequest<'OwnerUpdateRequested(uint256,uint8,bytes)'>;

  beforeAll(() => {
    jest.clearAllMocks();

    handler = new OwnerUpdateRequestedEventHandler();

    mockRequest = {
      id: randomUUID(),
      event: {
        args: [
          80920745289880686872077472087501508459438916877610571750365932290048n,
          0n,
          ethers.encodeBytes32String('name'),
        ],
        logIndex: 1,
        blockNumber: 1,
        blockTimestamp: new Date(),
        transactionHash: 'requestTransactionHash',
      } as EventData<'OwnerUpdateRequested(uint256,uint8,bytes)'>,
    };

    mockDbTransaction = {};

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));
  });

  describe('_handle', () => {
    test('should create new OwnerUpdateRequestedEventModel and GitProjectModel', async () => {
      // Arrange
      OwnerUpdateRequestedEventModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([
          {
            transactionHash: 'OwnerUpdateRequestedEventTransactionHash',
            logIndex: 1,
          },
          true,
        ]);

      GitProjectModel.findOrCreate = jest.fn().mockResolvedValue([
        {
          id: toRepoDriverId(mockRequest.event.args[0]),
        },
        true,
      ]);

      LogManager.prototype.appendFindOrCreateLog = jest.fn().mockReturnThis();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          args: [accountId, forge, name],
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
      } = mockRequest;

      expect(OwnerUpdateRequestedEventModel.findOrCreate).toHaveBeenCalledWith({
        lock: true,
        transaction: mockDbTransaction,
        where: {
          logIndex,
          transactionHash,
        },
        defaults: {
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          name: toReadable(name),
          forge: toForge(forge),
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
          isVisible: true,
          name: toReadable(name),
          forge: toForge(forge),
          url: toUrl(toForge(forge), toReadable(name)),
          verificationStatus: ProjectVerificationStatus.OwnerUpdateRequested,
        },
      });
    });

    test('should update the GitProjectModel when the incoming event is the latest', async () => {
      // Arrange
      OwnerUpdateRequestedEventModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([
          {
            transactionHash: 'OwnerUpdateRequestedEventTransactionHash',
            logIndex: 1,
          },
          true,
        ]);

      const mockGitProject = {
        name: '',
        forge: '',
        url: '',
        verificationStatus: ProjectVerificationStatus.Unclaimed,
        save: jest.fn(),
      };
      GitProjectModel.findOrCreate = jest
        .fn()
        .mockResolvedValue([mockGitProject, false]);

      (isLatestEvent as jest.Mock).mockResolvedValue(true);

      LogManager.prototype.appendIsLatestEventLog = jest.fn().mockReturnThis();

      // Act
      await handler['_handle'](mockRequest);

      // Assert
      const {
        event: {
          // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
          args: [_, forge, name],
        },
      } = mockRequest;

      expect(mockGitProject.name).toBe(toReadable(name));
      expect(mockGitProject.forge).toBe(toForge(forge));
      expect(mockGitProject.url).toBe(toUrl(toForge(forge), toReadable(name)));
      expect(mockGitProject.verificationStatus).toBe(
        calculateProjectStatus(mockGitProject as any),
      );
      expect(mockGitProject.save).toHaveBeenCalledWith({
        transaction: mockDbTransaction,
      });
    });
  });
});
