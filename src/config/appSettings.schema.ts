import { z } from 'zod';
import { SUPPORTED_NETWORKS } from '../core/constants';

const loggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['json', 'pretty']).default('pretty'),
  destination: z.enum(['console', 'file']).default('console'),
  filename: z.string().optional(),
});

export const appSettingsSchema = z.object({
  network: z.enum(SUPPORTED_NETWORKS),
  primaryRpcUrl: z.string().url(),
  primaryRpcAccessToken: z.string().optional(),
  fallbackRpcUrl: z.string().url().optional(),
  fallbackRpcAccessToken: z.string().optional(),
  logger: loggingConfigSchema,
  pollingInterval: z.number().positive().optional().default(5000),
  chunkSize: z.number().positive().optional().default(1000),
  confirmations: z.number().positive().optional().default(1),
  ipfsGatewayUrl: z
    .string()
    .url()
    .optional()
    .default('https://drips.mypinata.cloud'),
  queueUiPort: z.number().positive().optional().default(3000),
  redisConnectionString: z.string(),
  postgresConnectionString: z.string(),
  shouldStartMonitoringUI: z.boolean().optional().default(false),
  cacheInvalidationEndpoint: z.string(),
  visibilityThresholdBlockNumber: z.number().optional().default(0),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
