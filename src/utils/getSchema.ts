import type { DbSchema } from '../core/types';
import appSettings from '../config/appSettings';

export default function getSchema(): DbSchema {
  return appSettings.network as DbSchema;
}
