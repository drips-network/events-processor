import type { DbSchema } from '../core/types';
import config from '../config/appSettings';

export default function getSchema(): DbSchema {
  return config.network as DbSchema;
}
