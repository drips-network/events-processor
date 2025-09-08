import type { Transaction } from 'sequelize';
import { Op } from 'sequelize';
import { checkIncompleteDeadlineReceivers } from '../../src/utils/checkIncompleteDeadlineReceivers';
import SplitsReceiverModel from '../../src/models/SplitsReceiverModel';
import AccountSeenEventModel from '../../src/models/AccountSeenEventModel';
import { isRepoDeadlineDriverId } from '../../src/utils/accountIdUtils';
import type { AccountId } from '../../src/core/types';

jest.mock('../../src/models/SplitsReceiverModel');
jest.mock('../../src/models/AccountSeenEventModel');
jest.mock('../../src/utils/accountIdUtils');

describe('checkIncompleteDeadlineReceivers', () => {
  const mockSenderAccountId: AccountId = '123456789' as AccountId;
  const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } } as Transaction;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return false when deadlineReceivers.length === 0', async () => {
    const mockSplitsReceivers = [
      { receiverAccountId: 'regular-account-1' },
      { receiverAccountId: 'regular-account-2' },
    ];

    jest
      .mocked(SplitsReceiverModel.findAll)
      .mockResolvedValue(mockSplitsReceivers as any);
    jest.mocked(isRepoDeadlineDriverId).mockReturnValue(false);

    const result = await checkIncompleteDeadlineReceivers(
      mockSenderAccountId,
      mockTransaction,
    );

    expect(result).toBe(false);
    expect(SplitsReceiverModel.findAll).toHaveBeenCalledWith({
      where: { senderAccountId: mockSenderAccountId },
      transaction: mockTransaction,
      lock: mockTransaction.LOCK.UPDATE,
    });
    expect(AccountSeenEventModel.findAll).not.toHaveBeenCalled();
  });

  it('should return true when deadlineReceivers.length > 0 and AccountSeenEvent not found', async () => {
    const mockDeadlineReceiverId = 'deadline-receiver-id';
    const mockSplitsReceivers = [
      { receiverAccountId: 'regular-account' },
      { receiverAccountId: mockDeadlineReceiverId },
    ];

    jest
      .mocked(SplitsReceiverModel.findAll)
      .mockResolvedValue(mockSplitsReceivers as any);
    jest
      .mocked(isRepoDeadlineDriverId)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    jest.mocked(AccountSeenEventModel.findAll).mockResolvedValue([]);

    const result = await checkIncompleteDeadlineReceivers(
      mockSenderAccountId,
      mockTransaction,
    );

    expect(result).toBe(true);
    expect(AccountSeenEventModel.findAll).toHaveBeenCalledWith({
      where: { accountId: { [Op.in]: [mockDeadlineReceiverId] } },
      transaction: mockTransaction,
      lock: mockTransaction.LOCK.UPDATE,
    });
  });

  it('should return false when deadlineReceivers.length > 0 but all have AccountSeenEvents', async () => {
    const mockDeadlineReceiverId = 'deadline-receiver-id';
    const mockSplitsReceivers = [{ receiverAccountId: mockDeadlineReceiverId }];
    const mockAccountSeenEvent = { accountId: mockDeadlineReceiverId };

    jest
      .mocked(SplitsReceiverModel.findAll)
      .mockResolvedValue(mockSplitsReceivers as any);
    jest.mocked(isRepoDeadlineDriverId).mockReturnValue(true);
    jest
      .mocked(AccountSeenEventModel.findAll)
      .mockResolvedValue([mockAccountSeenEvent as any]);

    const result = await checkIncompleteDeadlineReceivers(
      mockSenderAccountId,
      mockTransaction,
    );

    expect(result).toBe(false);
    expect(AccountSeenEventModel.findAll).toHaveBeenCalledWith({
      where: { accountId: { [Op.in]: [mockDeadlineReceiverId] } },
      transaction: mockTransaction,
      lock: mockTransaction.LOCK.UPDATE,
    });
  });
});
