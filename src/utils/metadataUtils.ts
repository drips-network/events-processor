import { toUtf8String } from 'ethers';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { IpfsHash } from '../core/types';
import {
  immutableSplitsDriverMetadataParser,
  nftDriverAccountMetadataParser,
  repoDriverAccountMetadataParser,
} from '../metadata/schemas';
import appSettings from '../config/appSettings';

export function convertToIpfsHash(str: string): IpfsHash {
  const ipfsHash = toUtf8String(str);

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
  try {
    const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
    const metadata = nftDriverAccountMetadataParser.parseAny(ipfsFile);

    return metadata;
  } catch (error) {
    throw new Error(`Failed to fetch NFT driver metadata from IPFS: ${error}`);
  }
}

export async function getImmutableSpitsDriverMetadata(
  ipfsHash: IpfsHash,
): Promise<AnyVersion<typeof immutableSplitsDriverMetadataParser>> {
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = immutableSplitsDriverMetadataParser.parseAny(ipfsFile);

  return metadata;
}
