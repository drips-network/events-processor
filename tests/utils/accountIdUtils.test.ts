import {
  extractForgeFromAccountId,
  isOrcidAccount,
} from '../../src/utils/accountIdUtils';

describe('accountIdUtils', () => {
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
});
