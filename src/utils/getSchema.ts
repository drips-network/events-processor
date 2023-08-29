import type { DbSchema } from '../common/types';
import { getNetwork } from './getNetworkSettings';

export default function getSchema(): DbSchema {
  return getNetwork() as DbSchema;
}
