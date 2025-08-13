import type { Transaction } from 'sequelize';
import type { AccountId } from '../../src/core/types';
import { getAccountType } from '../../src/utils/getAccountType';
import DripListModel from '../../src/models/DripListModel';
import EcosystemMainAccountModel from '../../src/models/EcosystemMainAccountModel';
import SubListModel from '../../src/models/SubListModel';
import DeadlineModel from '../../src/models/DeadlineModel';
import LinkedIdentityModel from '../../src/models/LinkedIdentityModel';
import {
  getContractNameFromAccountId,
  convertToNftDriverId,
  convertToImmutableSplitsDriverId,
  convertToRepoDeadlineDriverId,
  convertToRepoDriverId,
  isOrcidAccount,
} from '../../src/utils/accountIdUtils';

jest.mock('../../src/models/DripListModel');
jest.mock('../../src/models/EcosystemMainAccountModel');
jest.mock('../../src/models/SubListModel');
jest.mock('../../src/models/DeadlineModel');
jest.mock('../../src/models/LinkedIdentityModel');
jest.mock('../../src/utils/accountIdUtils');

describe('getAccountType', () => {
  let mockTransaction: Transaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = {} as Transaction;
  });

  describe('repoDriver (project and linked_identity)', () => {
    it('should return "project" for regular repoDriver accounts', async () => {
      // Arrange.
      const accountId = 'repoDriver:123' as AccountId;
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('repoDriver');
      (isOrcidAccount as jest.Mock).mockReturnValue(false);

      // Act.
      const result = await getAccountType(accountId);

      // Assert.
      expect(result).toBe('project');
      expect(getContractNameFromAccountId).toHaveBeenCalledWith(accountId);
      expect(isOrcidAccount).toHaveBeenCalledWith(accountId);
    });

    it('should return "project" for regular repoDriver accounts with transaction', async () => {
      // Arrange.
      const accountId = 'repoDriver:456' as AccountId;
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('repoDriver');
      (isOrcidAccount as jest.Mock).mockReturnValue(false);

      // Act.
      const result = await getAccountType(accountId, mockTransaction);

      // Assert.
      expect(result).toBe('project');
      expect(getContractNameFromAccountId).toHaveBeenCalledWith(accountId);
      expect(isOrcidAccount).toHaveBeenCalledWith(accountId);
    });

    it('should return "linked_identity" for ORCID repoDriver accounts when exists in DB', async () => {
      // Arrange.
      const accountId = 'repoDriver:789' as AccountId;
      const convertedId = 'converted:789';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('repoDriver');
      (isOrcidAccount as jest.Mock).mockReturnValue(true);
      (convertToRepoDriverId as jest.Mock).mockReturnValue(convertedId);
      (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });

      // Act.
      const result = await getAccountType(accountId);

      // Assert.
      expect(result).toBe('linked_identity');
      expect(getContractNameFromAccountId).toHaveBeenCalledWith(accountId);
      expect(isOrcidAccount).toHaveBeenCalledWith(accountId);
      expect(convertToRepoDriverId).toHaveBeenCalledWith(accountId);
      expect(LinkedIdentityModel.findOne).toHaveBeenCalledWith({
        where: {
          accountId: convertedId,
          identityType: 'orcid',
        },
        transaction: undefined,
        attributes: ['accountId'],
      });
    });

    it('should return "linked_identity" for ORCID repoDriver accounts with transaction', async () => {
      // Arrange.
      const accountId = 'repoDriver:890' as AccountId;
      const convertedId = 'converted:890';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('repoDriver');
      (isOrcidAccount as jest.Mock).mockReturnValue(true);
      (convertToRepoDriverId as jest.Mock).mockReturnValue(convertedId);
      (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });

      // Act.
      const result = await getAccountType(accountId, mockTransaction);

      // Assert.
      expect(result).toBe('linked_identity');
      expect(LinkedIdentityModel.findOne).toHaveBeenCalledWith({
        where: {
          accountId: convertedId,
          identityType: 'orcid',
        },
        transaction: mockTransaction,
        attributes: ['accountId'],
      });
    });

    it('should throw error when ORCID LinkedIdentity not found in database', async () => {
      // Arrange.
      const accountId = 'repoDriver:999' as AccountId;
      const convertedId = 'converted:999';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('repoDriver');
      (isOrcidAccount as jest.Mock).mockReturnValue(true);
      (convertToRepoDriverId as jest.Mock).mockReturnValue(convertedId);
      (LinkedIdentityModel.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert.
      await expect(getAccountType(accountId)).rejects.toThrow();
    });
  });

  describe('addressDriver (address)', () => {
    it('should return "address" for addressDriver accounts', async () => {
      // Arrange.
      const accountId = 'addressDriver:0x123' as AccountId;
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'addressDriver',
      );

      // Act.
      const result = await getAccountType(accountId);

      // Assert.
      expect(result).toBe('address');
      expect(getContractNameFromAccountId).toHaveBeenCalledWith(accountId);
    });

    it('should return "address" for addressDriver accounts with transaction', async () => {
      // Arrange.
      const accountId = 'addressDriver:0x456' as AccountId;
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'addressDriver',
      );

      // Act.
      const result = await getAccountType(accountId, mockTransaction);

      // Assert.
      expect(result).toBe('address');
      expect(getContractNameFromAccountId).toHaveBeenCalledWith(accountId);
    });
  });

  describe('immutableSplitsDriver (sub_list)', () => {
    it('should return "sub_list" when SubList exists in database', async () => {
      // Arrange.
      const accountId = 'immutableSplitsDriver:123' as AccountId;
      const convertedId = 'converted:123';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'immutableSplitsDriver',
      );
      (convertToImmutableSplitsDriverId as jest.Mock).mockReturnValue(
        convertedId,
      );
      (SubListModel.findByPk as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });

      // Act.
      const result = await getAccountType(accountId);

      // Assert.
      expect(result).toBe('sub_list');
      expect(convertToImmutableSplitsDriverId).toHaveBeenCalledWith(accountId);
      expect(SubListModel.findByPk).toHaveBeenCalledWith(convertedId, {
        transaction: undefined,
        attributes: ['accountId'],
      });
    });

    it('should return "sub_list" with transaction when SubList exists', async () => {
      // Arrange.
      const accountId = 'immutableSplitsDriver:456' as AccountId;
      const convertedId = 'converted:456';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'immutableSplitsDriver',
      );
      (convertToImmutableSplitsDriverId as jest.Mock).mockReturnValue(
        convertedId,
      );
      (SubListModel.findByPk as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });

      // Act.
      const result = await getAccountType(accountId, mockTransaction);

      // Assert.
      expect(result).toBe('sub_list');
      expect(SubListModel.findByPk).toHaveBeenCalledWith(convertedId, {
        transaction: mockTransaction,
        attributes: ['accountId'],
      });
    });

    it('should throw error when SubList not found in database', async () => {
      // Arrange.
      const accountId = 'immutableSplitsDriver:789' as AccountId;
      const convertedId = 'converted:789';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'immutableSplitsDriver',
      );
      (convertToImmutableSplitsDriverId as jest.Mock).mockReturnValue(
        convertedId,
      );
      (SubListModel.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert.
      await expect(getAccountType(accountId)).rejects.toThrow();
    });
  });

  describe('repoDeadlineDriver (deadline)', () => {
    it('should return "deadline" when Deadline exists in database', async () => {
      // Arrange.
      const accountId = 'repoDeadlineDriver:123' as AccountId;
      const convertedId = 'converted:123';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'repoDeadlineDriver',
      );
      (convertToRepoDeadlineDriverId as jest.Mock).mockReturnValue(convertedId);
      (DeadlineModel.findByPk as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });

      // Act.
      const result = await getAccountType(accountId);

      // Assert.
      expect(result).toBe('deadline');
      expect(convertToRepoDeadlineDriverId).toHaveBeenCalledWith(accountId);
      expect(DeadlineModel.findByPk).toHaveBeenCalledWith(convertedId, {
        transaction: undefined,
        attributes: ['accountId'],
      });
    });

    it('should return "deadline" with transaction when Deadline exists', async () => {
      // Arrange.
      const accountId = 'repoDeadlineDriver:456' as AccountId;
      const convertedId = 'converted:456';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'repoDeadlineDriver',
      );
      (convertToRepoDeadlineDriverId as jest.Mock).mockReturnValue(convertedId);
      (DeadlineModel.findByPk as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });

      // Act.
      const result = await getAccountType(accountId, mockTransaction);

      // Assert.
      expect(result).toBe('deadline');
      expect(DeadlineModel.findByPk).toHaveBeenCalledWith(convertedId, {
        transaction: mockTransaction,
        attributes: ['accountId'],
      });
    });

    it('should throw error when Deadline not found in database', async () => {
      // Arrange.
      const accountId = 'repoDeadlineDriver:789' as AccountId;
      const convertedId = 'converted:789';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'repoDeadlineDriver',
      );
      (convertToRepoDeadlineDriverId as jest.Mock).mockReturnValue(convertedId);
      (DeadlineModel.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert.
      await expect(getAccountType(accountId)).rejects.toThrow();
    });
  });

  describe('repoSubAccountDriver (project)', () => {
    it('should return "project" for repoSubAccountDriver accounts', async () => {
      // Arrange.
      const accountId = 'repoSubAccountDriver:123' as AccountId;
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'repoSubAccountDriver',
      );

      // Act.
      const result = await getAccountType(accountId);

      // Assert.
      expect(result).toBe('project');
      expect(getContractNameFromAccountId).toHaveBeenCalledWith(accountId);
    });

    it('should return "project" for repoSubAccountDriver accounts with transaction', async () => {
      // Arrange.
      const accountId = 'repoSubAccountDriver:456' as AccountId;
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'repoSubAccountDriver',
      );

      // Act.
      const result = await getAccountType(accountId, mockTransaction);

      // Assert.
      expect(result).toBe('project');
      expect(getContractNameFromAccountId).toHaveBeenCalledWith(accountId);
    });
  });

  describe('nftDriver types', () => {
    it('should return "ecosystem_main_account" when EcosystemMainAccount exists', async () => {
      // Arrange.
      const accountId = 'nftDriver:123' as AccountId;
      const convertedId = 'converted:123';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('nftDriver');
      (convertToNftDriverId as jest.Mock).mockReturnValue(convertedId);
      (EcosystemMainAccountModel.findByPk as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });
      (DripListModel.findByPk as jest.Mock).mockResolvedValue(null);

      // Act.
      const result = await getAccountType(accountId);

      // Assert.
      expect(result).toBe('ecosystem_main_account');
      expect(convertToNftDriverId).toHaveBeenCalledWith(accountId);
      expect(EcosystemMainAccountModel.findByPk).toHaveBeenCalledWith(
        convertedId,
        {
          transaction: undefined,
          attributes: ['accountId'],
        },
      );
      expect(DripListModel.findByPk).toHaveBeenCalledWith(convertedId, {
        transaction: undefined,
        attributes: ['accountId'],
      });
    });

    it('should return "drip_list" when DripList exists but EcosystemMainAccount does not', async () => {
      // Arrange.
      const accountId = 'nftDriver:456' as AccountId;
      const convertedId = 'converted:456';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('nftDriver');
      (convertToNftDriverId as jest.Mock).mockReturnValue(convertedId);
      (EcosystemMainAccountModel.findByPk as jest.Mock).mockResolvedValue(null);
      (DripListModel.findByPk as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });

      // Act.
      const result = await getAccountType(accountId);

      // Assert.
      expect(result).toBe('drip_list');
    });

    it('should return "ecosystem_main_account" when both exist (ecosystem takes priority)', async () => {
      // Arrange.
      const accountId = 'nftDriver:789' as AccountId;
      const convertedId = 'converted:789';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('nftDriver');
      (convertToNftDriverId as jest.Mock).mockReturnValue(convertedId);
      (EcosystemMainAccountModel.findByPk as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });
      (DripListModel.findByPk as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });

      // Act.
      const result = await getAccountType(accountId);

      // Assert.
      expect(result).toBe('ecosystem_main_account');
    });

    it('should work with transaction parameter', async () => {
      // Arrange.
      const accountId = 'nftDriver:111' as AccountId;
      const convertedId = 'converted:111';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('nftDriver');
      (convertToNftDriverId as jest.Mock).mockReturnValue(convertedId);
      (EcosystemMainAccountModel.findByPk as jest.Mock).mockResolvedValue({
        accountId: convertedId,
      });
      (DripListModel.findByPk as jest.Mock).mockResolvedValue(null);

      // Act.
      const result = await getAccountType(accountId, mockTransaction);

      // Assert.
      expect(result).toBe('ecosystem_main_account');
      expect(EcosystemMainAccountModel.findByPk).toHaveBeenCalledWith(
        convertedId,
        {
          transaction: mockTransaction,
          attributes: ['accountId'],
        },
      );
      expect(DripListModel.findByPk).toHaveBeenCalledWith(convertedId, {
        transaction: mockTransaction,
        attributes: ['accountId'],
      });
    });

    it('should throw error when neither EcosystemMainAccount nor DripList exist', async () => {
      // Arrange.
      const accountId = 'nftDriver:999' as AccountId;
      const convertedId = 'converted:999';
      (getContractNameFromAccountId as jest.Mock).mockReturnValue('nftDriver');
      (convertToNftDriverId as jest.Mock).mockReturnValue(convertedId);
      (EcosystemMainAccountModel.findByPk as jest.Mock).mockResolvedValue(null);
      (DripListModel.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert.
      await expect(getAccountType(accountId)).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown contract name', async () => {
      // Arrange.
      const accountId = 'unknownDriver:123' as AccountId;
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'unknownDriver',
      );

      // Act & Assert.
      await expect(getAccountType(accountId)).rejects.toThrow();
    });

    it('should throw error for invalid contract name', async () => {
      // Arrange.
      const accountId = 'someInvalidDriver:456' as AccountId;
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'someInvalidDriver',
      );

      // Act & Assert.
      await expect(getAccountType(accountId)).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange.
      const accountId = 'immutableSplitsDriver:error' as AccountId;
      const convertedId = 'converted:error';
      const dbError = new Error('Database connection failed');
      (getContractNameFromAccountId as jest.Mock).mockReturnValue(
        'immutableSplitsDriver',
      );
      (convertToImmutableSplitsDriverId as jest.Mock).mockReturnValue(
        convertedId,
      );
      (SubListModel.findByPk as jest.Mock).mockRejectedValue(dbError);

      // Act & Assert.
      await expect(getAccountType(accountId)).rejects.toThrow(dbError);
    });
  });
});
