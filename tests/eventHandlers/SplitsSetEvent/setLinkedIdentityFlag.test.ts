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
    jest.mocked(SplitsReceiverModel.destroy).mockResolvedValue(0);

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

    expect(SplitsReceiverModel.destroy).toHaveBeenCalledWith({
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

  it('should update isLinked flag when validation returns false and NOT create splits', async () => {
    mockLinkedIdentity.isLinked = true;
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(
      mockLinkedIdentity,
    );
    (validateLinkedIdentity as jest.Mock).mockResolvedValue(false);
    jest.mocked(SplitsReceiverModel.destroy).mockResolvedValue(1);

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

    expect(SplitsReceiverModel.destroy).toHaveBeenCalledWith({
      where: { senderAccountId: mockAccountId },
      transaction: mockTransaction,
    });

    expect(receiversRepository.createSplitReceiver).not.toHaveBeenCalled();

    expect(mockLinkedIdentity.isLinked).toBe(false);
    expect(mockLinkedIdentity.save).toHaveBeenCalledWith({
      transaction: mockTransaction,
    });
    expect(mockScopedLogger.bufferMessage).toHaveBeenCalledWith(
      expect.stringContaining('WARNING: ORCID account'),
    );
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

  it('should always delete existing splits and recreate when isLinked is true', async () => {
    jest.mocked(SplitsReceiverModel.destroy).mockResolvedValue(1);

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

    expect(SplitsReceiverModel.destroy).toHaveBeenCalledWith({
      where: { senderAccountId: mockAccountId },
      transaction: mockTransaction,
    });
    expect(receiversRepository.createSplitReceiver).toHaveBeenCalled();

    expect(mockLinkedIdentity.isLinked).toBe(true);
    expect(mockLinkedIdentity.save).toHaveBeenCalledWith({
      transaction: mockTransaction,
    });
  });

  it('should handle case when zero splits are deleted', async () => {
    jest.mocked(SplitsReceiverModel.destroy).mockResolvedValue(0);

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

    expect(SplitsReceiverModel.destroy).toHaveBeenCalledWith({
      where: { senderAccountId: mockAccountId },
      transaction: mockTransaction,
    });

    expect(mockScopedLogger.bufferMessage).not.toHaveBeenCalledWith(
      expect.stringContaining('WARNING: Deleted'),
    );
    expect(receiversRepository.createSplitReceiver).toHaveBeenCalled();
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
