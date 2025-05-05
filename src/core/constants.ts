import { encodeBytes32String } from 'ethers';
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

export const DRIPS_CONTRACTS = [
  'drips',
  'nftDriver',
  'repoDriver',
  'addressDriver',
  'immutableSplitsDriver',
] as const;

export const DRIPS_APP_USER_METADATA_KEY = encodeBytes32String('ipfs');

export const COMMON_EVENT_INIT_ATTRIBUTES = {
  transactionHash: {
    primaryKey: true,
    allowNull: false,
    type: DataTypes.STRING,
  },
  logIndex: {
    primaryKey: true,
    allowNull: false,
    type: DataTypes.INTEGER,
  },
  blockTimestamp: {
    allowNull: false,
    type: DataTypes.DATE,
  },
  blockNumber: {
    allowNull: false,
    type: DataTypes.INTEGER,
  },
  createdAt: {
    allowNull: false,
    type: DataTypes.DATE,
  },
  updatedAt: {
    allowNull: false,
    type: DataTypes.DATE,
  },
} as const;
