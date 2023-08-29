import { getContractNameByAccountId } from '../../utils/getContract';

export default function isGitProject(accountId: string): boolean {
  return getContractNameByAccountId(accountId) === 'repoDriver';
}
