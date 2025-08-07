import type { Transaction } from 'sequelize';
import { setLinkedIdentityFlag } from '../../../src/eventHandlers/SplitsSetEvent/setLinkedIdentityFlag';
import LinkedIdentityModel from '../../../src/models/LinkedIdentityModel';
import { validateLinkedIdentity } from '../../../src/utils/validateLinkedIdentity';
import type ScopedLogger from '../../../src/core/ScopedLogger';
import type { AccountId } from '../../../src/core/types';
import { dripsContract } from '../../../src/core/contractClients';
import RecoverableError from '../../../src/utils/recoverableError';

jest.mock('../../../src/models/LinkedIdentityModel');
jest.mock('../../../src/utils/validateLinkedIdentity');
jest.mock('../../../src/core/contractClients', () => ({
  dripsContract: {
    splitsHash: jest.fn(),
  },
}));

describe('setLinkedIdentityFlag', () => {
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
  });

  it('should update isLinked flag when validation returns true', async () => {
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(
      mockLinkedIdentity,
    );
    (validateLinkedIdentity as jest.Mock).mockResolvedValue(true);

    const mockEvent = {
      accountId: mockAccountId,
      receiversHash: mockReceiversHash,
    };

    await setLinkedIdentityFlag(
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
    };

    await setLinkedIdentityFlag(
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
    };

    await setLinkedIdentityFlag(
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

  it('should throw RecoverableError when LinkedIdentity does not exist', async () => {
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(null);

    const mockEvent = {
      accountId: mockAccountId,
      receiversHash: mockReceiversHash,
    };

    await expect(
      setLinkedIdentityFlag(
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
