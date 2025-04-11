import { ethers } from 'ethers';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { IpfsHash } from '../core/types';
import {
  immutableSplitsDriverMetadataParser,
  nftDriverAccountMetadataParser,
  repoDriverAccountMetadataParser,
} from '../metadata/schemas';
import appSettings from '../config/appSettings';

export function convertToIpfsHash(str: string): IpfsHash {
  const ipfsHash = ethers.toUtf8String(str);

  const isIpfsHash = /^(Qm[a-zA-Z0-9]{44})$/.test(ipfsHash);

  if (!isIpfsHash) {
    throw new Error(`Failed to convert: '${str}' is not a valid IPFS hash.`);
  }

  return ipfsHash as IpfsHash;
}

export async function getProjectMetadata(
  ipfsHash: IpfsHash,
): Promise<AnyVersion<typeof repoDriverAccountMetadataParser>> {
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = repoDriverAccountMetadataParser.parseAny(ipfsFile);

  return metadata;
}

async function getIpfsFile(hash: IpfsHash): Promise<Response> {
  return fetch(`${appSettings.ipfsGatewayUrl}/ipfs/${hash}`);
}

export async function getNftDriverMetadata(
  ipfsHash: IpfsHash,
): Promise<AnyVersion<typeof nftDriverAccountMetadataParser>> {
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = nftDriverAccountMetadataParser.parseAny(ipfsFile);

  return metadata;
}

export async function getImmutableSpitsDriverMetadata(
  ipfsHash: IpfsHash,
): Promise<AnyVersion<typeof immutableSplitsDriverMetadataParser>> {
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = immutableSplitsDriverMetadataParser.parseAny(ipfsFile);

  return metadata;
}
