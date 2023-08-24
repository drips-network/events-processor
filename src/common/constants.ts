import { ethers } from 'ethers';
import { DataTypes } from 'sequelize';

export const SUPPORTED_NETWORKS = ['mainnet', 'sepolia', 'goerli'] as const;

export const SUPPORTED_CONTRACTS = [
  'drips',
  'nftDriver',
  'repoDriver',
  'addressDriver',
  'immutableSplitsDriver',
] as const;

export const USER_METADATA_KEY = ethers.hexlify(ethers.toUtf8Bytes('ipfs'));

export const COMMON_EVENT_INIT_ATTRIBUTES = {
  // Primary key
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  transactionHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  logIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  blockNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  blockTimestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  rawEvent: {
    type: DataTypes.JSON,
    allowNull: false,
  },
};
