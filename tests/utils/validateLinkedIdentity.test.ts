import type { Transaction } from 'sequelize';
import { validateLinkedIdentity } from '../../src/utils/validateLinkedIdentity';
import { dripsContract } from '../../src/core/contractClients';
import type { AccountId, AddressDriverId } from '../../src/core/types';
import * as checkIncompleteDeadlineReceiversModule from '../../src/utils/checkIncompleteDeadlineReceivers';

jest.mock('../../src/core/contractClients');
jest.mock('../../src/utils/checkIncompleteDeadlineReceivers');

describe('validateLinkedIdentity', () => {
  const mockAccountId =
    '81320912658542974439730181977206773330805723773165208113981035642880' as AccountId;
  const mockOwnerAccountId = '123456789' as AddressDriverId;
  const mockOnChainHash = '0xabcdef123456';
  const mockExpectedHash = '0xabcdef123456';
  const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } } as Transaction;

  beforeEach(() => {
    jest.resetAllMocks();

    jest
      .mocked(
        checkIncompleteDeadlineReceiversModule.checkIncompleteDeadlineReceivers,
      )
      .mockResolvedValue(false);
  });

  it('should return true when on-chain hash matches expected hash', async () => {
    // Arrange
    (dripsContract as any).splitsHash = jest
      .fn()
      .mockResolvedValue(mockOnChainHash);
    (dripsContract as any).hashSplits = jest
      .fn()
      .mockResolvedValue(mockExpectedHash);

    // Act
    const result = await validateLinkedIdentity(
      mockAccountId,
      mockOwnerAccountId,
      mockTransaction,
    );

    // Assert
    expect(result).toBe(true);
    expect(dripsContract.splitsHash).toHaveBeenCalledWith(mockAccountId);
    expect(dripsContract.hashSplits).toHaveBeenCalledWith([
      {
        accountId: mockOwnerAccountId,
        weight: 1_000_000,
      },
    ]);
  });

  it('should return false when on-chain hash does not match expected hash', async () => {
    // Arrange
    const differentHash = '0xdifferenthash';
    (dripsContract as any).splitsHash = jest
      .fn()
      .mockResolvedValue(mockOnChainHash);
    (dripsContract as any).hashSplits = jest
      .fn()
      .mockResolvedValue(differentHash);

    // Act
    const result = await validateLinkedIdentity(
      mockAccountId,
      mockOwnerAccountId,
      mockTransaction,
    );

    // Assert
    expect(result).toBe(false);
  });

  test('should return false when contract call throws error', async () => {
    // Arrange
    (dripsContract as any).splitsHash = jest
      .fn()
      .mockRejectedValue(new Error('Network error'));

    // Act
    const result = await validateLinkedIdentity(
      mockAccountId,
      mockOwnerAccountId,
      mockTransaction,
    );

    // Assert
    expect(result).toBe(false);
  });

  test('should return false when hashSplits throws error', async () => {
    // Arrange
    (dripsContract as any).splitsHash = jest
      .fn()
      .mockResolvedValue(mockOnChainHash);
    (dripsContract as any).hashSplits = jest
      .fn()
      .mockRejectedValue(new Error('Network error'));

    // Act
    const result = await validateLinkedIdentity(
      mockAccountId,
      mockOwnerAccountId,
      mockTransaction,
    );

    // Assert
    expect(result).toBe(false);
  });

  test('should return false when account has incomplete deadline receivers', async () => {
    // Arrange
    (dripsContract as any).splitsHash = jest
      .fn()
      .mockResolvedValue(mockOnChainHash);
    (dripsContract as any).hashSplits = jest
      .fn()
      .mockResolvedValue(mockExpectedHash);
    jest
      .mocked(
        checkIncompleteDeadlineReceiversModule.checkIncompleteDeadlineReceivers,
      )
      .mockResolvedValue(true);

    // Act
    const result = await validateLinkedIdentity(
      mockAccountId,
      mockOwnerAccountId,
      mockTransaction,
    );

    // Assert
    expect(result).toBe(false);
    expect(
      checkIncompleteDeadlineReceiversModule.checkIncompleteDeadlineReceivers,
    ).toHaveBeenCalledWith(mockAccountId, mockTransaction);
  });

  test('should return true when hash is valid and no incomplete deadline receivers', async () => {
    // Arrange
    (dripsContract as any).splitsHash = jest
      .fn()
      .mockResolvedValue(mockOnChainHash);
    (dripsContract as any).hashSplits = jest
      .fn()
      .mockResolvedValue(mockExpectedHash);
    jest
      .mocked(
        checkIncompleteDeadlineReceiversModule.checkIncompleteDeadlineReceivers,
      )
      .mockResolvedValue(false);

    // Act
    const result = await validateLinkedIdentity(
      mockAccountId,
      mockOwnerAccountId,
      mockTransaction,
    );

    // Assert
    expect(result).toBe(true);
    expect(
      checkIncompleteDeadlineReceiversModule.checkIncompleteDeadlineReceivers,
    ).toHaveBeenCalledWith(mockAccountId, mockTransaction);
  });
});
