import type { Transaction } from 'sequelize';
import { setLinkedIdentityFlag } from '../../../src/eventHandlers/SplitsSetEvent/setLinkedIdentityFlag';
import LinkedIdentityModel from '../../../src/models/LinkedIdentityModel';
import { validateLinkedIdentity } from '../../../src/utils/validateLinkedIdentity';
import type ScopedLogger from '../../../src/core/ScopedLogger';
import type { AccountId } from '../../../src/core/types';

jest.mock('../../../src/models/LinkedIdentityModel');
jest.mock('../../../src/utils/validateLinkedIdentity');

describe('setLinkedIdentityFlag', () => {
  let mockScopedLogger: ScopedLogger;
  let mockTransaction: Transaction;
  let mockLinkedIdentity: any;
  const mockAccountId: AccountId =
    '81320912658542974439730181977206773330805723773165208113981035642880' as AccountId;
  const mockOwnerAccountId = '123456789';

  beforeEach(() => {
    jest.clearAllMocks();

    mockScopedLogger = {
      log: jest.fn(),
      bufferUpdate: jest.fn(),
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
  });

  it('should update isLinked flag when validation returns true', async () => {
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(
      mockLinkedIdentity,
    );
    (validateLinkedIdentity as jest.Mock).mockResolvedValue(true);

    await setLinkedIdentityFlag(
      mockAccountId,
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

    await setLinkedIdentityFlag(
      mockAccountId,
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

  it('should not update when isLinked flag matches validation result', async () => {
    mockLinkedIdentity.isLinked = true;
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(
      mockLinkedIdentity,
    );
    (validateLinkedIdentity as jest.Mock).mockResolvedValue(true);

    await setLinkedIdentityFlag(
      mockAccountId,
      mockScopedLogger,
      mockTransaction,
    );

    expect(validateLinkedIdentity).toHaveBeenCalledWith(
      mockAccountId,
      mockOwnerAccountId,
    );

    expect(mockLinkedIdentity.save).not.toHaveBeenCalled();
    expect(mockScopedLogger.bufferUpdate).not.toHaveBeenCalled();
  });

  it('should log and return early when LinkedIdentity does not exist', async () => {
    (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(null);

    await setLinkedIdentityFlag(
      mockAccountId,
      mockScopedLogger,
      mockTransaction,
    );

    expect(LinkedIdentityModel.findOne).toHaveBeenCalledWith({
      where: { accountId: mockAccountId },
      transaction: mockTransaction,
      lock: mockTransaction.LOCK.UPDATE,
    });

    expect(validateLinkedIdentity).not.toHaveBeenCalled();
    expect(mockScopedLogger.bufferUpdate).not.toHaveBeenCalled();
  });
});
