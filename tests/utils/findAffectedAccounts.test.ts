import type { Transaction } from 'sequelize';
import { findAffectedAccounts } from '../../src/eventHandlers/AccountSeenEventHandler/findAffectedAccounts';
import SplitsReceiverModel from '../../src/models/SplitsReceiverModel';
import ProjectModel from '../../src/models/ProjectModel';
import DripListModel from '../../src/models/DripListModel';
import SubListModel from '../../src/models/SubListModel';
import EcosystemMainAccountModel from '../../src/models/EcosystemMainAccountModel';
import LinkedIdentityModel from '../../src/models/LinkedIdentityModel';
import type { AccountId } from '../../src/core/types';

jest.mock('../../src/models/SplitsReceiverModel');
jest.mock('../../src/models/ProjectModel');
jest.mock('../../src/models/DripListModel');
jest.mock('../../src/models/SubListModel');
jest.mock('../../src/models/EcosystemMainAccountModel');
jest.mock('../../src/models/LinkedIdentityModel');

describe('findAffectedAccounts', () => {
  const mockDeadlineAccountId: AccountId = 'deadline-123' as AccountId;
  const mockSenderAccountId1: AccountId = 'sender-1' as AccountId;
  const mockSenderAccountId2: AccountId = 'sender-2' as AccountId;
  const mockTransaction = {
    LOCK: {
      UPDATE: 'UPDATE',
    },
  } as Transaction;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const setupSplitsReceivers = (senderAccountIds: AccountId[]) => {
    const mockSplitsReceivers = senderAccountIds.map((id) => ({
      senderAccountId: id,
    }));
    jest
      .mocked(SplitsReceiverModel.findAll)
      .mockResolvedValue(mockSplitsReceivers as any);
  };

  const setupEntityMocks = (
    project?: any,
    dripList?: any,
    subList?: any,
    ecosystemMainAccount?: any,
    linkedIdentity?: any,
  ) => {
    jest.mocked(ProjectModel.findByPk).mockResolvedValue(project || null);
    jest.mocked(DripListModel.findByPk).mockResolvedValue(dripList || null);
    jest.mocked(SubListModel.findByPk).mockResolvedValue(subList || null);
    jest
      .mocked(EcosystemMainAccountModel.findByPk)
      .mockResolvedValue(ecosystemMainAccount || null);
    jest
      .mocked(LinkedIdentityModel.findByPk)
      .mockResolvedValue(linkedIdentity || null);
  };

  it('should return Project type for project entity', async () => {
    setupSplitsReceivers([mockSenderAccountId1]);
    setupEntityMocks({ accountId: mockSenderAccountId1 });

    const result = await findAffectedAccounts(
      mockDeadlineAccountId,
      mockTransaction,
    );

    expect(result).toEqual([
      {
        accountId: mockSenderAccountId1,
        type: 'Project',
      },
    ]);
    expect(SplitsReceiverModel.findAll).toHaveBeenCalledWith({
      where: { receiverAccountId: mockDeadlineAccountId },
      attributes: ['senderAccountId'],
      transaction: mockTransaction,
    });
  });

  it('should return DripList type for drip list entity', async () => {
    setupSplitsReceivers([mockSenderAccountId1]);
    setupEntityMocks(null, { accountId: mockSenderAccountId1 });

    const result = await findAffectedAccounts(
      mockDeadlineAccountId,
      mockTransaction,
    );

    expect(result).toEqual([
      {
        accountId: mockSenderAccountId1,
        type: 'DripList',
      },
    ]);
  });

  it('should return SubList type for sub list entity', async () => {
    setupSplitsReceivers([mockSenderAccountId1]);
    setupEntityMocks(null, null, { accountId: mockSenderAccountId1 });

    const result = await findAffectedAccounts(
      mockDeadlineAccountId,
      mockTransaction,
    );

    expect(result).toEqual([
      {
        accountId: mockSenderAccountId1,
        type: 'SubList',
      },
    ]);
  });

  it('should return EcosystemMainAccount type for ecosystem main account entity', async () => {
    setupSplitsReceivers([mockSenderAccountId1]);
    setupEntityMocks(null, null, null, { accountId: mockSenderAccountId1 });

    const result = await findAffectedAccounts(
      mockDeadlineAccountId,
      mockTransaction,
    );

    expect(result).toEqual([
      {
        accountId: mockSenderAccountId1,
        type: 'EcosystemMainAccount',
      },
    ]);
  });

  it('should return LinkedIdentity type for linked identity entity', async () => {
    setupSplitsReceivers([mockSenderAccountId1]);
    setupEntityMocks(null, null, null, null, {
      accountId: mockSenderAccountId1,
    });

    const result = await findAffectedAccounts(
      mockDeadlineAccountId,
      mockTransaction,
    );

    expect(result).toEqual([
      {
        accountId: mockSenderAccountId1,
        type: 'LinkedIdentity',
      },
    ]);
  });

  it('should return multiple affected accounts of different types', async () => {
    setupSplitsReceivers([mockSenderAccountId1, mockSenderAccountId2]);

    jest
      .mocked(ProjectModel.findByPk)
      .mockResolvedValueOnce({ accountId: mockSenderAccountId1 } as any)
      .mockResolvedValueOnce(null);

    jest
      .mocked(DripListModel.findByPk)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ accountId: mockSenderAccountId2 } as any);

    jest.mocked(SubListModel.findByPk).mockResolvedValue(null);
    jest.mocked(EcosystemMainAccountModel.findByPk).mockResolvedValue(null);
    jest.mocked(LinkedIdentityModel.findByPk).mockResolvedValue(null);

    const result = await findAffectedAccounts(
      mockDeadlineAccountId,
      mockTransaction,
    );

    expect(result).toEqual([
      {
        accountId: mockSenderAccountId1,
        type: 'Project',
      },
      {
        accountId: mockSenderAccountId2,
        type: 'DripList',
      },
    ]);
  });

  it('should skip accounts that do not exist in any entity table', async () => {
    setupSplitsReceivers([mockSenderAccountId1]);
    setupEntityMocks(); // All null

    const result = await findAffectedAccounts(
      mockDeadlineAccountId,
      mockTransaction,
    );

    expect(result).toEqual([]);
  });

  it('should handle duplicate sender account IDs', async () => {
    const mockSplitsReceivers = [
      { senderAccountId: mockSenderAccountId1 },
      { senderAccountId: mockSenderAccountId1 }, // Duplicate
      { senderAccountId: mockSenderAccountId2 },
    ];
    jest
      .mocked(SplitsReceiverModel.findAll)
      .mockResolvedValue(mockSplitsReceivers as any);

    jest
      .mocked(ProjectModel.findByPk)
      .mockResolvedValueOnce({ accountId: mockSenderAccountId1 } as any)
      .mockResolvedValueOnce({ accountId: mockSenderAccountId2 } as any);

    jest.mocked(DripListModel.findByPk).mockResolvedValue(null);
    jest.mocked(SubListModel.findByPk).mockResolvedValue(null);
    jest.mocked(EcosystemMainAccountModel.findByPk).mockResolvedValue(null);
    jest.mocked(LinkedIdentityModel.findByPk).mockResolvedValue(null);

    const result = await findAffectedAccounts(
      mockDeadlineAccountId,
      mockTransaction,
    );

    expect(result).toEqual([
      {
        accountId: mockSenderAccountId1,
        type: 'Project',
      },
      {
        accountId: mockSenderAccountId2,
        type: 'Project',
      },
    ]);
    // Should only call findByPk twice due to Set deduplication
    expect(ProjectModel.findByPk).toHaveBeenCalledTimes(2);
  });

  it('should throw critical bug error when account exists in multiple entity tables', async () => {
    setupSplitsReceivers([mockSenderAccountId1]);
    setupEntityMocks(
      { accountId: mockSenderAccountId1 }, // Project
      { accountId: mockSenderAccountId1 }, // DripList
    );

    await expect(
      findAffectedAccounts(mockDeadlineAccountId, mockTransaction),
    ).rejects.toThrow(
      `CRITICAL BUG: Account ${mockSenderAccountId1} exists in multiple entity tables: Project, DripList`,
    );
  });
});
