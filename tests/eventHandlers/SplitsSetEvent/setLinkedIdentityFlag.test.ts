import type { Transaction } from 'sequelize';
import { processLinkedIdentitySplits } from '../../../src/eventHandlers/SplitsSetEvent/processLinkedIdentitySplits';
import LinkedIdentityModel from '../../../src/models/LinkedIdentityModel';
import { validateLinkedIdentity } from '../../../src/utils/validateLinkedIdentity';
import type ScopedLogger from '../../../src/core/ScopedLogger';
import type { AccountId } from '../../../src/core/types';
import { dripsContract } from '../../../src/core/contractClients';
import RecoverableError from '../../../src/utils/recoverableError';
import { SplitsReceiverModel } from '../../../src/models';
import * as receiversRepository from '../../../src/eventHandlers/AccountMetadataEmittedEvent/receiversRepository';
import * as accountIdUtils from '../../../src/utils/accountIdUtils';

jest.mock('../../../src/models/LinkedIdentityModel');
jest.mock('../../../src/models/SplitsReceiverModel');
jest.mock('../../../src/utils/validateLinkedIdentity');
jest.mock(
  '../../../src/eventHandlers/AccountMetadataEmittedEvent/receiversRepository',
);
jest.mock('../../../src/utils/accountIdUtils');
jest.mock('../../../src/core/contractClients', () => ({
  dripsContract: {
    splitsHash: jest.fn(),
  },
}));

describe('processLinkedIdentitySplits', () => {
  let mockScopedLogger: ScopedLogger;
  let mockTransaction: Transaction;
  let mockLinkedIdentity: any;
  const mockAccountId: AccountId =
    '81320912658542974439730181977206773330805723773165208113981035642880' as AccountId;
  const mockOwnerAccountId = '123456789';
  const mockReceiversHash = '0xabc123';

  beforeEach(() => {
    jest.clearAllMocks();

    mockScopedLogger = {
      log: jest.fn(),
      bufferUpdate: jest.fn(),
      bufferMessage: jest.fn(),
      bufferCreation: jest.fn(),
    } as any;

    mockTransaction = {
      LOCK: {
        UPDATE: 'UPDATE',
      },
    } as any;

    mockLinkedIdentity = {
      accountId: mockAccountId,
      ownerAccountId: mockOwnerAccountId,
      isLinked: false,
      save: jest.fn(),
    };

    jest.mocked(dripsContract.splitsHash).mockResolvedValue(mockReceiversHash);
    jest.mocked(SplitsReceiverModel.findAll).mockResolvedValue([]);
    jest.mocked(SplitsReceiverModel.destroy).mockResolvedValue(0);
    jest
      .mocked(receiversRepository.createSplitReceiver)
      .mockResolvedValue(undefined);
    jest.mocked(accountIdUtils.assertIsRepoDriverId);
  });

  it('should update isLinked flag when validation returns true and create splits record', async () => {
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(
      mockLinkedIdentity,
    );
    (validateLinkedIdentity as jest.Mock).mockResolvedValue(true);

    const mockEvent = {
      accountId: mockAccountId,
      receiversHash: mockReceiversHash,
      blockTimestamp: new Date('2024-01-01'),
    };

    await processLinkedIdentitySplits(
      mockEvent as any,
      mockScopedLogger,
      mockTransaction,
    );

    expect(LinkedIdentityModel.findOne).toHaveBeenCalledWith({
      where: { accountId: mockAccountId },
      transaction: mockTransaction,
      lock: mockTransaction.LOCK.UPDATE,
    });

    expect(validateLinkedIdentity).toHaveBeenCalledWith(
      mockAccountId,
      mockOwnerAccountId,
    );

    expect(SplitsReceiverModel.findAll).toHaveBeenCalledWith({
      where: { senderAccountId: mockAccountId },
      transaction: mockTransaction,
    });

    expect(receiversRepository.createSplitReceiver).toHaveBeenCalledWith({
      scopedLogger: mockScopedLogger,
      transaction: mockTransaction,
      splitReceiverShape: {
        senderAccountType: 'linked_identity',
        senderAccountId: mockAccountId,
        receiverAccountType: 'address',
        receiverAccountId: mockOwnerAccountId,
        relationshipType: 'identity_owner',
        weight: 1_000_000,
        blockTimestamp: new Date('2024-01-01'),
      },
    });

    expect(mockLinkedIdentity.isLinked).toBe(true);
    expect(mockLinkedIdentity.save).toHaveBeenCalledWith({
      transaction: mockTransaction,
    });
  });

  it('should update isLinked flag when validation returns false', async () => {
    mockLinkedIdentity.isLinked = true;
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(
      mockLinkedIdentity,
    );
    (validateLinkedIdentity as jest.Mock).mockResolvedValue(false);

    const mockEvent = {
      accountId: mockAccountId,
      receiversHash: mockReceiversHash,
      blockTimestamp: new Date('2024-01-01'),
    };

    await processLinkedIdentitySplits(
      mockEvent as any,
      mockScopedLogger,
      mockTransaction,
    );

    expect(validateLinkedIdentity).toHaveBeenCalledWith(
      mockAccountId,
      mockOwnerAccountId,
    );

    expect(mockLinkedIdentity.isLinked).toBe(false);
    expect(mockLinkedIdentity.save).toHaveBeenCalledWith({
      transaction: mockTransaction,
    });
  });

  it('should skip when on-chain hash does not match event hash', async () => {
    jest.mocked(dripsContract.splitsHash).mockResolvedValue('0xdifferent');
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(
      mockLinkedIdentity,
    );

    const mockEvent = {
      accountId: mockAccountId,
      receiversHash: mockReceiversHash,
      blockTimestamp: new Date('2024-01-01'),
    };

    await processLinkedIdentitySplits(
      mockEvent as any,
      mockScopedLogger,
      mockTransaction,
    );

    expect(LinkedIdentityModel.findOne).not.toHaveBeenCalled();
    expect(validateLinkedIdentity).not.toHaveBeenCalled();
    expect(mockScopedLogger.bufferMessage).toHaveBeenCalledWith(
      expect.stringContaining('Skipped setting'),
    );
  });

  it('should cleanup and recreate splits record when it already exists', async () => {
    const mockExistingSplits = [{ id: 1, senderAccountId: mockAccountId }];
    jest
      .mocked(SplitsReceiverModel.findAll)
      .mockResolvedValue(mockExistingSplits as any);

    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(
      mockLinkedIdentity,
    );
    (validateLinkedIdentity as jest.Mock).mockResolvedValue(true);

    const mockEvent = {
      accountId: mockAccountId,
      receiversHash: mockReceiversHash,
      blockTimestamp: new Date('2024-01-01'),
    };

    await processLinkedIdentitySplits(
      mockEvent as any,
      mockScopedLogger,
      mockTransaction,
    );

    expect(SplitsReceiverModel.findAll).toHaveBeenCalledWith({
      where: { senderAccountId: mockAccountId },
      transaction: mockTransaction,
    });

    // Should cleanup existing record
    expect(SplitsReceiverModel.destroy).toHaveBeenCalledWith({
      where: { senderAccountId: mockAccountId },
      transaction: mockTransaction,
    });

    // Should create a new splits record
    expect(receiversRepository.createSplitReceiver).toHaveBeenCalled();

    expect(mockLinkedIdentity.isLinked).toBe(true);
    expect(mockLinkedIdentity.save).toHaveBeenCalledWith({
      transaction: mockTransaction,
    });
  });

  it('should throw error when multiple splits receivers found', async () => {
    const mockExistingSplits = [
      { id: 1, senderAccountId: mockAccountId },
      { id: 2, senderAccountId: mockAccountId },
    ];
    jest
      .mocked(SplitsReceiverModel.findAll)
      .mockResolvedValue(mockExistingSplits as any);

    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(
      mockLinkedIdentity,
    );
    (validateLinkedIdentity as jest.Mock).mockResolvedValue(true);

    const mockEvent = {
      accountId: mockAccountId,
      receiversHash: mockReceiversHash,
      blockTimestamp: new Date('2024-01-01'),
    };

    await expect(
      processLinkedIdentitySplits(
        mockEvent as any,
        mockScopedLogger,
        mockTransaction,
      ),
    ).rejects.toThrow(
      `Found 2 splits receivers for ORCID account ${mockAccountId}, expected 1`,
    );

    expect(SplitsReceiverModel.findAll).toHaveBeenCalledWith({
      where: { senderAccountId: mockAccountId },
      transaction: mockTransaction,
    });

    // Should not proceed to create or destroy
    expect(SplitsReceiverModel.destroy).not.toHaveBeenCalled();
    expect(receiversRepository.createSplitReceiver).not.toHaveBeenCalled();
  });

  it('should throw RecoverableError when LinkedIdentity does not exist', async () => {
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(null);

    const mockEvent = {
      accountId: mockAccountId,
      receiversHash: mockReceiversHash,
      blockTimestamp: new Date('2024-01-01'),
    };

    await expect(
      processLinkedIdentitySplits(
        mockEvent as any,
        mockScopedLogger,
        mockTransaction,
      ),
    ).rejects.toThrow(RecoverableError);

    expect(LinkedIdentityModel.findOne).toHaveBeenCalledWith({
      where: { accountId: mockAccountId },
      transaction: mockTransaction,
      lock: mockTransaction.LOCK.UPDATE,
    });

    expect(validateLinkedIdentity).not.toHaveBeenCalled();
    expect(mockScopedLogger.bufferUpdate).not.toHaveBeenCalled();
  });
});
