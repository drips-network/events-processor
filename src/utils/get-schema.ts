import type { DbSchema } from '../common/types';
import { getNetwork } from './get-network-settings';

export default function getSchema(): DbSchema {
  return getNetwork();
}
