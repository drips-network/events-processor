import {
  getDripsContract,
  getAddressDriverContract,
  getNftDriverContract,
  getRepoDriverContract,
} from '../../contracts/contract-types';
import loadChainConfig from '../config/loadChainConfig';
import FailoverProvider from './FailoverProvider';

const { contracts } = loadChainConfig();
const { drips, addressDriver, nftDriver, repoDriver } = contracts;

export async function dripContract() {
  return getDripsContract(drips.address, FailoverProvider.getActiveProvider());
}

export async function addressDriverContract() {
  return getAddressDriverContract(
    addressDriver.address,
    FailoverProvider.getActiveProvider(),
  );
}

export async function nftDriverContract() {
  return getNftDriverContract(
    nftDriver.address,
    FailoverProvider.getActiveProvider(),
  );
}

export async function repoDriverContract() {
  return getRepoDriverContract(
    repoDriver.address,
    FailoverProvider.getActiveProvider(),
  );
}
