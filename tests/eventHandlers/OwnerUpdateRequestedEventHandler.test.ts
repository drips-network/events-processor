/* eslint-disable dot-notation */
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import { OwnerUpdateRequestedEventHandler } from '../../src/eventHandlers';
import { dbConnection } from '../../src/db/database';
import type { EventData } from '../../src/events/types';
import { convertToRepoDriverId } from '../../src/utils/accountIdUtils';
import {
  calculateProjectStatus,
  toForge,
  toReadable,
  toUrl,
} from '../../src/utils/projectUtils';
import OwnerUpdateRequestedEventModel from '../../src/models/OwnerUpdateRequestedEventModel';
import ProjectModel, {
  ProjectVerificationStatus,
} from '../../src/models/ProjectModel';
import LogManager from '../../src/core/LogManager';
import { isLatestEvent } from '../../src/utils/isLatestEvent';

jest.mock('../../src/models/OwnerUpdateRequestedEventModel');
jest.mock('../../src/models/ProjectModel');
jest.mock('../../src/db/database');
jest.mock('bee-queue');
jest.mock('../../src/events/eventHandlerUtils');
jest.mock('../../src/core/LogManager');
jest.mock('../../src/utils/isLatestEvent');

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
    test('should create new OwnerUpdateRequestedEventModel', async () => {
      // Arrange
      OwnerUpdateRequestedEventModel.create = jest.fn().mockResolvedValue([
        {
          transactionHash: 'OwnerUpdateRequestedEventTransactionHash',
          logIndex: 1,
        },
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

      expect(OwnerUpdateRequestedEventModel.create).toHaveBeenCalledWith(
        {
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
          name: toReadable(name),
          forge: toForge(forge),
          accountId: convertToRepoDriverId(accountId),
        },
        {
          transaction: mockDbTransaction,
        },
      );
    });

    test('should update the ProjectModel when the incoming event is the latest', async () => {
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
      ProjectModel.findByPk = jest.fn().mockResolvedValue(mockGitProject);

      (isLatestEvent as jest.Mock).mockResolvedValue(true);

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
