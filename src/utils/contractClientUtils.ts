import {
  Drips__factory,
  RepoDriver__factory,
  NftDriver__factory,
  AddressDriver__factory,
} from '../../contracts';
import type {
  NftDriver,
  Drips,
  RepoDriver,
  AddressDriver,
} from '../../contracts';
import { getNetworkSettings } from './getNetworkSettings';

export async function getDripsClient(): Promise<Drips> {
  const {
    provider,
    chainConfig: { drips },
  } = await getNetworkSettings();

  return Drips__factory.connect(drips.address as string, provider);
}

export async function getAddressDriverClient(): Promise<AddressDriver> {
  const {
    provider,
    chainConfig: { addressDriver },
  } = await getNetworkSettings();

  return AddressDriver__factory.connect(
    addressDriver.address as string,
    provider,
  );
}

export async function getNftDriverClient(): Promise<NftDriver> {
  const {
    provider,
    chainConfig: { nftDriver },
  } = await getNetworkSettings();

  return NftDriver__factory.connect(nftDriver.address as string, provider);
}

export async function getRepoDriverClient(): Promise<RepoDriver> {
  const {
    provider,
    chainConfig: { repoDriver },
  } = await getNetworkSettings();

  return RepoDriver__factory.connect(repoDriver.address as string, provider);
}
