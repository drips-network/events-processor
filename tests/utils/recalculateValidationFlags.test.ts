import type { Transaction } from 'sequelize';
import { recalculateValidationFlags } from '../../src/eventHandlers/AccountSeenEventHandler/recalculateValidationFlags';
import type { AffectedAccount } from '../../src/eventHandlers/AccountSeenEventHandler/findAffectedAccounts';
import type { AccountId, AddressDriverId } from '../../src/core/types';
import type ScopedLogger from '../../src/core/ScopedLogger';
import {
  ProjectModel,
  DripListModel,
  EcosystemMainAccountModel,
  SubListModel,
  LinkedIdentityModel,
  SplitsReceiverModel,
} from '../../src/models';
import {
  dripsContract,
  nftDriverContract,
  repoDriverContract,
} from '../../src/core/contractClients';
import { formatSplitReceivers } from '../../src/utils/formatSplitReceivers';
import { checkIncompleteDeadlineReceivers } from '../../src/utils/checkIncompleteDeadlineReceivers';
import { validateLinkedIdentity } from '../../src/utils/validateLinkedIdentity';

jest.mock('../../src/models', () => ({
  ProjectModel: {
    findByPk: jest.fn(),
  },
  DripListModel: {
    findByPk: jest.fn(),
  },
  EcosystemMainAccountModel: {
    findByPk: jest.fn(),
  },
  SubListModel: {
    findByPk: jest.fn(),
  },
  LinkedIdentityModel: {
    findByPk: jest.fn(),
  },
  SplitsReceiverModel: {
    findAll: jest.fn(),
  },
}));
jest.mock('../../src/core/contractClients', () => ({
  dripsContract: {
    splitsHash: jest.fn(),
    hashSplits: jest.fn(),
  },
  nftDriverContract: {
    ownerOf: jest.fn(),
  },
  repoDriverContract: {
    ownerOf: jest.fn(),
  },
}));
jest.mock('../../src/utils/accountIdUtils');
jest.mock('../../src/utils/formatSplitReceivers');
jest.mock('../../src/utils/checkIncompleteDeadlineReceivers');
jest.mock('../../src/utils/validateLinkedIdentity');

describe('recalculateValidationFlags', () => {
  const mockAccountId = '123456789' as AccountId;
  const mockOwnerAccountId = '987654321' as AddressDriverId;
  const mockOwnerAddress = '0x1234567890abcdef';
  const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } } as Transaction;
  const mockScopedLogger = {
    bufferMessage: jest.fn(),
    bufferUpdate: jest.fn(),
  } as unknown as ScopedLogger;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('LinkedIdentity type recalculation', () => {
    it('should recalculate LinkedIdentity isLinked flag when changed', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'LinkedIdentity' },
      ];

      const mockLinkedIdentity = {
        isLinked: false,
        ownerAccountId: mockOwnerAccountId,
        save: jest.fn(),
      };

      jest
        .mocked(LinkedIdentityModel.findByPk)
        .mockResolvedValue(mockLinkedIdentity as any);
      jest.mocked(validateLinkedIdentity).mockResolvedValue(true);

      await recalculateValidationFlags(
        affectedAccounts,
        mockScopedLogger,
        mockTransaction,
      );

      expect(LinkedIdentityModel.findByPk).toHaveBeenCalledWith(mockAccountId, {
        transaction: mockTransaction,
        lock: 'UPDATE',
      });
      expect(validateLinkedIdentity).toHaveBeenCalledWith(
        mockAccountId,
        mockOwnerAccountId,
        mockTransaction,
      );
      expect(mockLinkedIdentity.isLinked).toBe(true);
      expect(mockLinkedIdentity.save).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
      expect(mockScopedLogger.bufferUpdate).toHaveBeenCalledWith({
        id: mockAccountId,
        type: LinkedIdentityModel,
        input: mockLinkedIdentity,
      });
      expect(mockScopedLogger.bufferMessage).toHaveBeenCalledWith(
        `Recalculated LinkedIdentity ${mockAccountId} isLinked flag: false → true`,
      );
    });

    it('should not save LinkedIdentity when isLinked flag unchanged', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'LinkedIdentity' },
      ];

      const mockLinkedIdentity = {
        isLinked: true,
        ownerAccountId: mockOwnerAccountId,
        save: jest.fn(),
      };

      jest
        .mocked(LinkedIdentityModel.findByPk)
        .mockResolvedValue(mockLinkedIdentity as any);
      jest.mocked(validateLinkedIdentity).mockResolvedValue(true);

      await recalculateValidationFlags(
        affectedAccounts,
        mockScopedLogger,
        mockTransaction,
      );

      expect(mockLinkedIdentity.save).not.toHaveBeenCalled();
      expect(mockScopedLogger.bufferUpdate).not.toHaveBeenCalled();
    });

    it('should throw RecoverableError when LinkedIdentity not found', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'LinkedIdentity' },
      ];

      jest.mocked(LinkedIdentityModel.findByPk).mockResolvedValue(null);

      await expect(
        recalculateValidationFlags(
          affectedAccounts,
          mockScopedLogger,
          mockTransaction,
        ),
      ).rejects.toThrow(
        `LinkedIdentity ${mockAccountId} not found during recalculation. Waiting for entity creation.`,
      );
    });
  });

  describe('Project type recalculation', () => {
    it('should recalculate Project isValid flag when changed', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'Project' },
      ];

      const mockProject = {
        isValid: false,
        ownerAddress: mockOwnerAddress,
        save: jest.fn(),
      };

      const mockOnChainReceiversHash = '0xabcdef123456';
      const mockDbReceiversHash = '0xabcdef123456';

      jest.mocked(ProjectModel.findByPk).mockResolvedValue(mockProject as any);
      jest
        .mocked(dripsContract.splitsHash)
        .mockResolvedValue(mockOnChainReceiversHash);
      jest
        .mocked(repoDriverContract.ownerOf)
        .mockResolvedValue(mockOwnerAddress);
      jest.mocked(checkIncompleteDeadlineReceivers).mockResolvedValue(false);

      // Mock hashDbSplits via SplitsReceiverModel and related functions
      jest.mocked(SplitsReceiverModel.findAll).mockResolvedValue([]);
      jest.mocked(formatSplitReceivers).mockReturnValue([]);
      jest
        .mocked(dripsContract.hashSplits)
        .mockResolvedValue(mockDbReceiversHash);

      await recalculateValidationFlags(
        affectedAccounts,
        mockScopedLogger,
        mockTransaction,
      );

      expect(ProjectModel.findByPk).toHaveBeenCalledWith(mockAccountId, {
        transaction: mockTransaction,
        lock: 'UPDATE',
      });
      expect(dripsContract.splitsHash).toHaveBeenCalledWith(mockAccountId);
      expect(repoDriverContract.ownerOf).toHaveBeenCalledWith(mockAccountId);
      expect(checkIncompleteDeadlineReceivers).toHaveBeenCalledWith(
        mockAccountId,
        mockTransaction,
      );
      expect(mockProject.isValid).toBe(true);
      expect(mockProject.save).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
    });

    it('should skip Project recalculation when owner mismatch', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'Project' },
      ];

      const mockProject = {
        isValid: false,
        ownerAddress: mockOwnerAddress,
        save: jest.fn(),
      };

      const differentOwner = '0xdifferentowner';

      jest.mocked(ProjectModel.findByPk).mockResolvedValue(mockProject as any);
      jest.mocked(dripsContract.splitsHash).mockResolvedValue('0xhash');
      jest.mocked(repoDriverContract.ownerOf).mockResolvedValue(differentOwner);
      jest.mocked(SplitsReceiverModel.findAll).mockResolvedValue([]);
      jest.mocked(formatSplitReceivers).mockReturnValue([]);
      jest.mocked(dripsContract.hashSplits).mockResolvedValue('0xhash');

      await expect(
        recalculateValidationFlags(
          affectedAccounts,
          mockScopedLogger,
          mockTransaction,
        ),
      ).rejects.toThrow(
        `Owner mismatch for Project ${mockAccountId}: on-chain ${differentOwner} vs DB ${mockOwnerAddress}. Waiting for owner update.`,
      );

      expect(mockProject.save).not.toHaveBeenCalled();
    });
  });

  describe('DripList type recalculation', () => {
    it('should recalculate DripList isValid flag correctly', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'DripList' },
      ];

      const mockDripList = {
        isValid: false,
        ownerAddress: mockOwnerAddress,
        save: jest.fn(),
      };

      const mockOnChainReceiversHash = '0xabcdef123456';
      const mockDbReceiversHash = '0xabcdef123456';

      jest
        .mocked(DripListModel.findByPk)
        .mockResolvedValue(mockDripList as any);
      jest
        .mocked(dripsContract.splitsHash)
        .mockResolvedValue(mockOnChainReceiversHash);
      jest
        .mocked(nftDriverContract.ownerOf)
        .mockResolvedValue(mockOwnerAddress);
      jest.mocked(checkIncompleteDeadlineReceivers).mockResolvedValue(false);

      // Mock hashDbSplits
      jest.mocked(SplitsReceiverModel.findAll).mockResolvedValue([]);
      jest.mocked(formatSplitReceivers).mockReturnValue([]);
      jest
        .mocked(dripsContract.hashSplits)
        .mockResolvedValue(mockDbReceiversHash);

      await recalculateValidationFlags(
        affectedAccounts,
        mockScopedLogger,
        mockTransaction,
      );

      expect(DripListModel.findByPk).toHaveBeenCalledWith(mockAccountId, {
        transaction: mockTransaction,
        lock: 'UPDATE',
      });
      expect(nftDriverContract.ownerOf).toHaveBeenCalledWith(mockAccountId);
      expect(mockDripList.isValid).toBe(true);
      expect(mockDripList.save).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
    });
  });

  describe('SubList type recalculation', () => {
    it('should recalculate SubList isValid flag correctly', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'SubList' },
      ];

      const mockSubList = {
        isValid: false,
        save: jest.fn(),
      };

      const mockOnChainReceiversHash = '0xabcdef123456';
      const mockDbReceiversHash = '0xabcdef123456';

      jest.mocked(SubListModel.findByPk).mockResolvedValue(mockSubList as any);
      jest
        .mocked(dripsContract.splitsHash)
        .mockResolvedValue(mockOnChainReceiversHash);
      jest.mocked(checkIncompleteDeadlineReceivers).mockResolvedValue(false);

      // Mock hashDbSplits
      jest.mocked(SplitsReceiverModel.findAll).mockResolvedValue([]);
      jest.mocked(formatSplitReceivers).mockReturnValue([]);
      jest
        .mocked(dripsContract.hashSplits)
        .mockResolvedValue(mockDbReceiversHash);

      await recalculateValidationFlags(
        affectedAccounts,
        mockScopedLogger,
        mockTransaction,
      );

      expect(SubListModel.findByPk).toHaveBeenCalledWith(mockAccountId, {
        transaction: mockTransaction,
        lock: 'UPDATE',
      });
      expect(mockSubList.isValid).toBe(true);
      expect(mockSubList.save).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
    });
  });

  describe('EcosystemMainAccount type recalculation', () => {
    it('should recalculate EcosystemMainAccount isValid flag correctly', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'EcosystemMainAccount' },
      ];

      const mockEcosystemMainAccount = {
        isValid: false,
        ownerAddress: mockOwnerAddress,
        save: jest.fn(),
      };

      const mockOnChainReceiversHash = '0xabcdef123456';
      const mockDbReceiversHash = '0xabcdef123456';

      jest
        .mocked(EcosystemMainAccountModel.findByPk)
        .mockResolvedValue(mockEcosystemMainAccount as any);
      jest
        .mocked(dripsContract.splitsHash)
        .mockResolvedValue(mockOnChainReceiversHash);
      jest
        .mocked(nftDriverContract.ownerOf)
        .mockResolvedValue(mockOwnerAddress);
      jest.mocked(checkIncompleteDeadlineReceivers).mockResolvedValue(false);

      // Mock hashDbSplits
      jest.mocked(SplitsReceiverModel.findAll).mockResolvedValue([]);
      jest.mocked(formatSplitReceivers).mockReturnValue([]);
      jest
        .mocked(dripsContract.hashSplits)
        .mockResolvedValue(mockDbReceiversHash);

      await recalculateValidationFlags(
        affectedAccounts,
        mockScopedLogger,
        mockTransaction,
      );

      expect(EcosystemMainAccountModel.findByPk).toHaveBeenCalledWith(
        mockAccountId,
        {
          transaction: mockTransaction,
          lock: 'UPDATE',
        },
      );
      expect(nftDriverContract.ownerOf).toHaveBeenCalledWith(mockAccountId);
      expect(mockEcosystemMainAccount.isValid).toBe(true);
      expect(mockEcosystemMainAccount.save).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
    });
  });

  describe('Error handling', () => {
    it('should propagate error and stop processing when one account fails', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'Project' },
        { accountId: '987654321' as AccountId, type: 'DripList' },
      ];

      // First account (Project) will throw error
      jest
        .mocked(ProjectModel.findByPk)
        .mockRejectedValue(new Error('Database error'));

      await expect(
        recalculateValidationFlags(
          affectedAccounts,
          mockScopedLogger,
          mockTransaction,
        ),
      ).rejects.toThrow('Database error');

      // Second account should not be processed since error stops processing
      expect(DripListModel.findByPk).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty affectedAccounts array', async () => {
      const affectedAccounts: AffectedAccount[] = [];

      await recalculateValidationFlags(
        affectedAccounts,
        mockScopedLogger,
        mockTransaction,
      );

      expect(mockScopedLogger.bufferMessage).not.toHaveBeenCalled();
      expect(mockScopedLogger.bufferUpdate).not.toHaveBeenCalled();
    });

    it('should handle hash mismatch making account invalid', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'Project' },
      ];

      const mockProject = {
        isValid: true,
        ownerAddress: mockOwnerAddress,
        save: jest.fn(),
      };

      const mockOnChainReceiversHash = '0xabcdef123456';
      const mockDbReceiversHash = '0xdifferenthash';

      jest.mocked(ProjectModel.findByPk).mockResolvedValue(mockProject as any);
      jest
        .mocked(dripsContract.splitsHash)
        .mockResolvedValue(mockOnChainReceiversHash);
      jest
        .mocked(repoDriverContract.ownerOf)
        .mockResolvedValue(mockOwnerAddress);
      jest.mocked(checkIncompleteDeadlineReceivers).mockResolvedValue(false);
      jest.mocked(SplitsReceiverModel.findAll).mockResolvedValue([]);
      jest.mocked(formatSplitReceivers).mockReturnValue([]);
      jest
        .mocked(dripsContract.hashSplits)
        .mockResolvedValue(mockDbReceiversHash);

      await recalculateValidationFlags(
        affectedAccounts,
        mockScopedLogger,
        mockTransaction,
      );

      expect(mockProject.isValid).toBe(false);
      expect(mockProject.save).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
      expect(mockScopedLogger.bufferMessage).toHaveBeenCalledWith(
        `Recalculated Project ${mockAccountId} isValid flag: true → false`,
      );
    });

    it('should handle incomplete deadline receivers making account invalid', async () => {
      const affectedAccounts: AffectedAccount[] = [
        { accountId: mockAccountId, type: 'Project' },
      ];

      const mockProject = {
        isValid: true,
        ownerAddress: mockOwnerAddress,
        save: jest.fn(),
      };

      const mockOnChainReceiversHash = '0xabcdef123456';
      const mockDbReceiversHash = '0xabcdef123456';

      jest.mocked(ProjectModel.findByPk).mockResolvedValue(mockProject as any);
      jest
        .mocked(dripsContract.splitsHash)
        .mockResolvedValue(mockOnChainReceiversHash);
      jest
        .mocked(repoDriverContract.ownerOf)
        .mockResolvedValue(mockOwnerAddress);
      jest.mocked(checkIncompleteDeadlineReceivers).mockResolvedValue(true);
      jest.mocked(SplitsReceiverModel.findAll).mockResolvedValue([]);
      jest.mocked(formatSplitReceivers).mockReturnValue([]);
      jest
        .mocked(dripsContract.hashSplits)
        .mockResolvedValue(mockDbReceiversHash);

      await recalculateValidationFlags(
        affectedAccounts,
        mockScopedLogger,
        mockTransaction,
      );

      expect(mockProject.isValid).toBe(false);
      expect(mockProject.save).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
    });
  });
});
