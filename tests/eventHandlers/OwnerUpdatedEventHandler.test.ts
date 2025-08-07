/* eslint-disable dot-notation */
import { Wallet } from 'ethers';
import type { RepoDriverId } from '../../src/core/types';
import OwnerUpdatedEventHandler from '../../src/eventHandlers/OwnerUpdatedEventHandler';
import type EventHandlerRequest from '../../src/events/EventHandlerRequest';
import {
  repoDriverContract,
  addressDriverContract,
} from '../../src/core/contractClients';
import { dbConnection } from '../../src/db/database';
import OwnerUpdatedEventModel from '../../src/models/OwnerUpdatedEventModel';
import { LinkedIdentityModel, ProjectModel } from '../../src/models';
import * as receiversRepository from '../../src/eventHandlers/AccountMetadataEmittedEvent/receiversRepository';
import * as projectUtils from '../../src/utils/projectUtils';
import { makeVersion } from '../../src/utils/lastProcessedVersion';
import ScopedLogger from '../../src/core/ScopedLogger';
import * as validateLinkedIdentityModule from '../../src/utils/validateLinkedIdentity';

jest.mock('../../src/models/OwnerUpdatedEventModel');
jest.mock('../../src/models');
jest.mock('../../src/core/contractClients');
jest.mock('../../src/db/database');
jest.mock(
  '../../src/eventHandlers/AccountMetadataEmittedEvent/receiversRepository',
);
jest.mock('../../src/utils/projectUtils');
jest.mock('../../src/core/ScopedLogger');
jest.mock('../../src/utils/validateLinkedIdentity');
jest.mock('bee-queue');

describe('OwnerUpdatedEventHandler', () => {
  let handler: OwnerUpdatedEventHandler;
  let mockRequest: EventHandlerRequest<'OwnerUpdated(uint256,address)'>;
  let mockDbTransaction: {};

  const mockOrcidAccountId =
    '81320912658542974439730181977206773330805723773165208113981035642880' as RepoDriverId; // ORCID account
  const mockProjectId =
    '80904476653030408870644821256816768152249563001421913220796675056650' as RepoDriverId; // GitHub account
  const mockOwnerAddress = Wallet.createRandom().address;
  const mockBlockTimestamp = new Date('2025-07-29T13:00:00.000Z');
  const mockBlockNumber = 1;
  const mockLogIndex = 1;
  const mockExpectedVersion = makeVersion(
    mockBlockNumber,
    mockLogIndex,
  ).toString();
  const mockGitHubBlockNumber = 2;
  const mockGitHubLogIndex = 2;
  const mockGitHubExpectedVersion = makeVersion(
    mockGitHubBlockNumber,
    mockGitHubLogIndex,
  ).toString();
  const mockScopedLogger = {
    log: jest.fn(),
    bufferCreation: jest.fn(),
    bufferUpdate: jest.fn(),
    flush: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    handler = new OwnerUpdatedEventHandler();

    mockRequest = {
      id: 'test-request-id',
      event: {
        args: [BigInt(mockOrcidAccountId), mockOwnerAddress],
        logIndex: mockLogIndex,
        blockNumber: mockBlockNumber,
        blockTimestamp: mockBlockTimestamp,
        transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        eventSignature: 'OwnerUpdated(uint256,address)',
      },
    };

    mockDbTransaction = {
      LOCK: { UPDATE: jest.fn() },
    };

    (repoDriverContract as any).ownerOf = jest
      .fn()
      .mockResolvedValue(mockOwnerAddress);

    (addressDriverContract as any).calcAccountId = jest
      .fn()
      .mockResolvedValue(123456789n);

    dbConnection.transaction = jest
      .fn()
      .mockImplementation((callback) => callback(mockDbTransaction));

    OwnerUpdatedEventModel.create = jest.fn().mockResolvedValue({
      transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
      logIndex: mockLogIndex,
      blockNumber: mockBlockNumber,
      blockTimestamp: mockBlockTimestamp,
      accountId: mockOrcidAccountId,
      owner: mockOwnerAddress,
    });

    (LinkedIdentityModel as any).findOrCreate = jest.fn().mockResolvedValue([
      {
        accountId: mockOrcidAccountId,
        ownerAccountId: '123456789',
      },
      true,
    ]);

    (ProjectModel as any).findOrCreate = jest.fn().mockResolvedValue([
      {
        accountId: mockProjectId,
        ownerAddress: mockOwnerAddress,
        ownerAccountId: '123456789',
        save: jest.fn(),
      },
      true,
    ]);

    (receiversRepository.createSplitReceiver as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (receiversRepository.deleteExistingSplitReceivers as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);

    (projectUtils.calculateProjectStatus as jest.Mock) = jest
      .fn()
      .mockReturnValue('pending_metadata');

    (ScopedLogger as jest.MockedClass<typeof ScopedLogger>).mockImplementation(
      () => mockScopedLogger as any,
    );

    (validateLinkedIdentityModule.validateLinkedIdentity as jest.Mock) = jest
      .fn()
      .mockResolvedValue(true);
  });

  it('should create an OwnerUpdatedEventModel', async () => {
    // Arrange
    const mockOwnerUpdatedEventModel = {
      transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
      logIndex: mockLogIndex,
      blockNumber: mockBlockNumber,
      blockTimestamp: mockBlockTimestamp,
      accountId: mockRequest.event.args[0],
      owner: mockRequest.event.args[1],
    };

    // Act
    await handler['_handle'](mockRequest);

    // Assert
    expect(OwnerUpdatedEventModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionHash: mockOwnerUpdatedEventModel.transactionHash,
        logIndex: mockOwnerUpdatedEventModel.logIndex,
        blockNumber: mockOwnerUpdatedEventModel.blockNumber,
        blockTimestamp: mockOwnerUpdatedEventModel.blockTimestamp,
        accountId: mockOrcidAccountId,
        owner: mockOwnerUpdatedEventModel.owner,
      }),
      { transaction: mockDbTransaction },
    );
  });

  it('should create a linked identity when account ID is ORCID', async () => {
    // Arrange
    (validateLinkedIdentityModule.validateLinkedIdentity as jest.Mock) = jest
      .fn()
      .mockResolvedValue(false);

    // Act
    await handler['_handle'](mockRequest);

    // Assert
    expect(LinkedIdentityModel.findOrCreate).toHaveBeenCalledWith({
      transaction: mockDbTransaction,
      lock: (mockDbTransaction as any).LOCK.UPDATE,
      where: {
        accountId: mockOrcidAccountId,
      },
      defaults: {
        accountId: mockOrcidAccountId,
        identityType: 'orcid',
        ownerAddress: mockOwnerAddress,
        ownerAccountId: '123456789',
        isLinked: false,
        lastProcessedVersion: mockExpectedVersion,
      },
    });
  });

  it('should create a project when account ID is github', async () => {
    // Arrange - Create a GitHub account request
    const mockGitHubRequest: EventHandlerRequest<'OwnerUpdated(uint256,address)'> =
      {
        id: 'test-github-request-id',
        event: {
          args: [BigInt(mockProjectId), mockOwnerAddress],
          logIndex: mockGitHubLogIndex,
          blockNumber: mockGitHubBlockNumber,
          blockTimestamp: mockBlockTimestamp,
          transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          eventSignature: 'OwnerUpdated(uint256,address)',
        },
      };

    // Act
    await handler['_handle'](mockGitHubRequest);

    // Assert
    expect(ProjectModel.findOrCreate).toHaveBeenCalledWith({
      transaction: mockDbTransaction,
      lock: (mockDbTransaction as any).LOCK.UPDATE,
      where: {
        accountId: mockProjectId,
      },
      defaults: {
        accountId: mockProjectId,
        ownerAddress: mockOwnerAddress,
        ownerAccountId: '123456789',
        claimedAt: mockBlockTimestamp,
        verificationStatus: 'pending_metadata',
        isVisible: true,
        isValid: true,
        lastProcessedVersion: mockGitHubExpectedVersion,
      },
    });
  });

  it('should update existing linked identity when account ID is ORCID', async () => {
    // Arrange
    const oldVersion = makeVersion(
      mockBlockNumber - 1,
      mockLogIndex,
    ).toString();
    const existingLinkedIdentity: any = {
      accountId: mockOrcidAccountId,
      ownerAccountId: '987654321', // Old owner account ID
      ownerAddress: '0x1234567890123456789012345678901234567890', // Old owner address
      lastProcessedVersion: oldVersion,
      save: jest.fn(),
    };

    (LinkedIdentityModel as any).findOrCreate = jest
      .fn()
      .mockResolvedValue([existingLinkedIdentity, false]); // false = not a creation

    // Act
    await handler['_handle'](mockRequest);

    // Assert
    expect(existingLinkedIdentity.ownerAddress).toBe(mockOwnerAddress);
    expect(existingLinkedIdentity.ownerAccountId).toBe('123456789');
    expect(existingLinkedIdentity.isLinked).toBe(true); // the mocked validateLinkedIdentity returns true.
    expect(existingLinkedIdentity.lastProcessedVersion).toBe(
      mockExpectedVersion,
    );
    expect(existingLinkedIdentity.save).toHaveBeenCalledWith({
      transaction: mockDbTransaction,
    });
  });

  it('should update existing project when account ID is github', async () => {
    // Arrange
    const oldProjectVersion = makeVersion(
      mockGitHubBlockNumber - 1,
      mockGitHubLogIndex,
    ).toString();
    const existingProject: any = {
      accountId: mockProjectId,
      ownerAccountId: '987654321', // Old owner account ID
      ownerAddress: '0x1234567890123456789012345678901234567890', // Old owner address
      lastProcessedVersion: oldProjectVersion,
      verificationStatus: 'verified', // Old status
      claimedAt: new Date('2025-07-28T13:00:00.000Z'), // Old claimed date
      save: jest.fn(),
    };

    (ProjectModel as any).findOrCreate = jest
      .fn()
      .mockResolvedValue([existingProject, false]); // false = not a creation

    const mockGitHubRequest: EventHandlerRequest<'OwnerUpdated(uint256,address)'> =
      {
        id: 'test-github-update-request-id',
        event: {
          args: [BigInt(mockProjectId), mockOwnerAddress],
          logIndex: mockGitHubLogIndex,
          blockNumber: mockGitHubBlockNumber,
          blockTimestamp: mockBlockTimestamp,
          transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          eventSignature: 'OwnerUpdated(uint256,address)',
        },
      };

    // Act
    await handler['_handle'](mockGitHubRequest);

    // Assert
    expect(existingProject.ownerAddress).toBe(mockOwnerAddress);
    expect(existingProject.ownerAccountId).toBe('123456789');
    expect(existingProject.claimedAt).toBe(mockBlockTimestamp);
    expect(existingProject.lastProcessedVersion).toBe(
      mockGitHubExpectedVersion,
    );
    expect(existingProject.save).toHaveBeenCalledWith({
      transaction: mockDbTransaction,
    });
  });

  it('should ensure ownerAccountId matches calculated account ID from ownerAddress for ORCID accounts', async () => {
    // Arrange
    const testOwnerAddress = '0x1234567890123456789012345678901234567890';
    const expectedAccountId = '123456789';

    jest.mocked(repoDriverContract.ownerOf).mockResolvedValue(testOwnerAddress);

    const testRequest: EventHandlerRequest<'OwnerUpdated(uint256,address)'> = {
      id: 'test-validation-request',
      event: {
        args: [BigInt(mockOrcidAccountId), testOwnerAddress],
        logIndex: mockLogIndex,
        blockNumber: mockBlockNumber,
        blockTimestamp: mockBlockTimestamp,
        transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        eventSignature: 'OwnerUpdated(uint256,address)',
      },
    };

    // Act
    await handler['_handle'](testRequest);

    // Assert
    expect(addressDriverContract.calcAccountId).toHaveBeenCalledWith(
      testOwnerAddress,
    );
    expect(LinkedIdentityModel.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaults: expect.objectContaining({
          ownerAddress: testOwnerAddress,
          ownerAccountId: expectedAccountId,
        }),
      }),
    );
  });

  it('should ensure ownerAccountId matches calculated account ID from ownerAddress for GitHub projects', async () => {
    // Arrange
    const testOwnerAddress = '0x9876543210987654321098765432109876543210';
    const expectedAccountId = '123456789'; // Use the same as the global mock

    jest.mocked(repoDriverContract.ownerOf).mockResolvedValue(testOwnerAddress);

    const testRequest: EventHandlerRequest<'OwnerUpdated(uint256,address)'> = {
      id: 'test-github-validation-request',
      event: {
        args: [BigInt(mockProjectId), testOwnerAddress],
        logIndex: mockGitHubLogIndex,
        blockNumber: mockGitHubBlockNumber,
        blockTimestamp: mockBlockTimestamp,
        transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        eventSignature: 'OwnerUpdated(uint256,address)',
      },
    };

    // Act
    await handler['_handle'](testRequest);

    // Assert
    expect(addressDriverContract.calcAccountId).toHaveBeenCalledWith(
      testOwnerAddress,
    );
    expect(ProjectModel.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaults: expect.objectContaining({
          ownerAddress: testOwnerAddress,
          ownerAccountId: expectedAccountId,
        }),
      }),
    );
  });
});
