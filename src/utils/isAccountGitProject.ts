import { getContractNameByAccountId } from './getContract';

export default function isAccountGitProject(accountId: string): boolean {
  return getContractNameByAccountId(accountId) === 'repoDriver';
}
