import { ethers } from 'ethers';
import { DataTypes } from 'sequelize';

export const SUPPORTED_NETWORKS = [
  'mainnet',
  'sepolia',
  'localtestnet',
  'optimism_sepolia',
  'polygon_amoy',
  'filecoin',
  'metis',
  'optimism',
] as const;

export const FORGES_MAP = {
  0: 'GitHub',
  1: 'GitLab',
} as const;

export const DRIPS_CONTRACTS = [
  'drips',
  'nftDriver',
  'repoDriver',
  'addressDriver',
  'immutableSplitsDriver',
] as const;

export const DRIPS_APP_USER_METADATA_KEY = ethers.encodeBytes32String('ipfs');

export const COMMON_EVENT_INIT_ATTRIBUTES = {
  transactionHash: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  logIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  blockTimestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  blockNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
} as const;
