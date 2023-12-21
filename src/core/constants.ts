import { ethers } from 'ethers';

export const SUPPORTED_NETWORKS = [
  'mainnet',
  'sepolia',
  'goerli',
  'localtestnet',
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
