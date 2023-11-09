import fs from 'fs';
import path from 'path';
import type { ChainConfig } from '../core/types';
import appSettings from './appSettings';
import logger from '../core/logger';

export default function loadChainConfig(): ChainConfig {
  const { network } = appSettings;

  try {
    const fileNameWithExtension = `${network}.json`;
    const rootDir = path.resolve(__dirname, '..');
    const filePath = path.join(
      rootDir,
      'config',
      'chainConfigs',
      fileNameWithExtension,
    );

    const fileContent = fs.readFileSync(filePath, 'utf-8');

    const chainConfig: ChainConfig = JSON.parse(fileContent);

    return chainConfig;
  } catch (error: any) {
    logger.error(`Error reading ${network} config file: ${error}`);

    throw error;
  }
}
