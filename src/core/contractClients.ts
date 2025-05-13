import {
  getDripsContract,
  getAddressDriverContract,
  getNftDriverContract,
  getRepoDriverContract,
  getRepoSubAccountDriverContract,
} from '../../contracts/contract-types';
import loadChainConfig from '../config/loadChainConfig';
import getProvider from './getProvider';

const { contracts } = loadChainConfig();
const { drips, addressDriver, nftDriver, repoDriver, repoSubAccountDriver } =
  contracts;

const provider = getProvider();

export const dripsContract = getDripsContract(drips.address, provider);

export const addressDriverContract = getAddressDriverContract(
  addressDriver.address,
  provider,
);

export const nftDriverContract = getNftDriverContract(
  nftDriver.address,
  provider,
);

export const repoDriverContract = getRepoDriverContract(
  repoDriver.address,
  provider,
);

export const repoSubAccountDriverContract = getRepoSubAccountDriverContract(
  repoSubAccountDriver.address,
  provider,
);
