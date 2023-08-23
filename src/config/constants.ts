import { ethers } from 'ethers';

export const SUPPORTED_NETWORKS = ['mainnet', 'sepolia', 'goerli'] as const;
export const SUPPORTED_CONTRACTS = [
  'drips',
  'nftDriver',
  'repoDriver',
  'addressDriver',
  'immutableSplitsDriver',
] as const;
export const USER_METADATA_KEY = ethers.hexlify(ethers.toUtf8Bytes('ipfs'));
