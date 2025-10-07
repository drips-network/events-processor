import {
  assertIsAccountId,
  assertIsRepoDeadlineDriverId,
  convertToAccountId,
  convertToRepoDeadlineDriverId,
  extractForgeFromAccountId,
  getContractNameFromAccountId,
  isOrcidAccount,
  isRepoDeadlineDriverId,
} from '../../src/utils/accountIdUtils';

describe('accountIdUtils', () => {
  describe('getContractNameFromAccountId', () => {
    it('should return repoDeadlineDriver for RepoDeadlineDriverId', () => {
      const validRepoDeadlineDriverId =
        '134824369987331688459978851430856029499523851846503058183003895555073';
      const result = getContractNameFromAccountId(validRepoDeadlineDriverId);
      expect(result).toBe('repoDeadlineDriver');
    });
  });

  describe('extractForgeFromAccountId', () => {
    it('should extract forge ID from different valid RepoDriver IDs', () => {
      const testCases = [
        {
          accountId:
            '80904476653030408870644821256816768152249563001421913220796675056641',
          expectedForge: 0,
        }, // GitHub
        {
          accountId:
            '81062312897154340170689580289742573450728728362822266554565141725186',
          expectedForge: 1,
        }, // GitLab
        {
          accountId:
            '81320912658542974439730181977206773330805723773165208113981035642880',
          expectedForge: 4,
        }, // ORCID
      ];

      testCases.forEach(({ accountId, expectedForge }) => {
        const result = extractForgeFromAccountId(accountId);
        expect(result).toBe(expectedForge);
      });
    });

    it('should throw error for non-RepoDriver account ID', () => {
      const addressDriverId = '123456789';

      expect(() => extractForgeFromAccountId(addressDriverId)).toThrow(
        "Cannot extract forge: '123456789' is not a RepoDriver ID.",
      );
    });
  });

  describe('isOrcidAccount', () => {
    it('should return true for valid ORCID account ID', () => {
      const orcidAccountId =
        '81320912658542974439730181977206773330805723773165208113981035642880';
      const result = isOrcidAccount(orcidAccountId);
      expect(result).toBe(true);
    });

    it('should return false for GitHub account ID', () => {
      const githubAccountId =
        '80904476653030408870644821256816768152249563001421913220796675056646';
      const result = isOrcidAccount(githubAccountId);
      expect(result).toBe(false);
    });
  });

  describe('RepoDeadlineDriver functions', () => {
    const validRepoDeadlineDriverId =
      '134824369987331688459978851430856029499523851846503058183003895555073';

    describe('isRepoDeadlineDriverId', () => {
      it('should return true for valid RepoDeadlineDriver ID as string', () => {
        const result = isRepoDeadlineDriverId(validRepoDeadlineDriverId);
        expect(result).toBe(true);
      });

      it('should return true for valid RepoDeadlineDriver ID as bigint', () => {
        const result = isRepoDeadlineDriverId(
          BigInt(validRepoDeadlineDriverId),
        );
        expect(result).toBe(true);
      });

      it('should return false for invalid ID', () => {
        const result = isRepoDeadlineDriverId('123456789');
        expect(result).toBe(false);
      });

      it('should return false for NaN string', () => {
        expect(() => isRepoDeadlineDriverId('not-a-number')).toThrow();
      });
    });

    describe('convertToRepoDeadlineDriverId', () => {
      it('should convert valid string ID to RepoDeadlineDriverId', () => {
        const result = convertToRepoDeadlineDriverId(validRepoDeadlineDriverId);
        expect(result).toBe(validRepoDeadlineDriverId);
      });

      it('should convert valid bigint ID to RepoDeadlineDriverId', () => {
        const result = convertToRepoDeadlineDriverId(
          BigInt(validRepoDeadlineDriverId),
        );
        expect(result).toBe(validRepoDeadlineDriverId);
      });

      it('should throw error for invalid ID', () => {
        expect(() => convertToRepoDeadlineDriverId('123456789')).toThrow(
          "Failed to convert: '123456789' is not a valid RepoDeadlineDriver ID.",
        );
      });
    });

    describe('assertIsRepoDeadlineDriverId', () => {
      it('should not throw for valid RepoDeadlineDriver ID', () => {
        expect(() =>
          assertIsRepoDeadlineDriverId(validRepoDeadlineDriverId),
        ).not.toThrow();
      });

      it('should throw error for invalid ID', () => {
        expect(() => assertIsRepoDeadlineDriverId('123456789')).toThrow(
          "Failed to assert: '123456789' is not a valid RepoDeadlineDriver ID.",
        );
      });
    });
  });

  describe('convertToAccountId', () => {
    it('should convert valid RepoDeadlineDriverId to AccountId', () => {
      const validRepoDeadlineDriverId =
        '134824369987331688459978851430856029499523851846503058183003895555073';
      const result = convertToAccountId(validRepoDeadlineDriverId);
      expect(result).toBe(validRepoDeadlineDriverId);
    });

    it('should convert valid RepoDeadlineDriverId bigint to AccountId', () => {
      const validRepoDeadlineDriverId =
        '134824369987331688459978851430856029499523851846503058183003895555073';
      const result = convertToAccountId(BigInt(validRepoDeadlineDriverId));
      expect(result).toBe(validRepoDeadlineDriverId);
    });
  });

  describe('assertIsAccountId', () => {
    it('should not throw for valid RepoDeadlineDriverId', () => {
      const validRepoDeadlineDriverId =
        '134824369987331688459978851430856029499523851846503058183003895555073';
      expect(() => assertIsAccountId(validRepoDeadlineDriverId)).not.toThrow();
    });

    it('should not throw for valid RepoDeadlineDriverId bigint', () => {
      const validRepoDeadlineDriverId =
        '134824369987331688459978851430856029499523851846503058183003895555073';
      expect(() =>
        assertIsAccountId(BigInt(validRepoDeadlineDriverId)),
      ).not.toThrow();
    });
  });
});
