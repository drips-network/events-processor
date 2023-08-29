import type { ProjectId } from '../../common/types';
import { getContractNameByAccountId } from '../../utils/getContract';

export default function isProjectId(id: string): id is ProjectId {
  const isNaN = Number.isNaN(Number(id));
  const isRepoDriverId = getContractNameByAccountId(id) === 'repoDriver';

  if (isNaN || !isRepoDriverId) {
    return false;
  }

  return true;
}
