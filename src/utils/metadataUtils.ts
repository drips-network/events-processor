import { ethers } from 'ethers';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { IpfsHash } from '../common/types';
import {
  nftDriverAccountMetadataParser,
  repoDriverAccountMetadataParser,
} from '../metadata/schemas';

export function toIpfsHash(str: string): IpfsHash {
  const ipfsHash = ethers.toUtf8String(str);

  const isIpfsHash = /^(Qm[a-zA-Z0-9]{44})$/.test(ipfsHash);

  if (!isIpfsHash) {
    throw new Error('The provided string is not a valid IPFS hash.');
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

const IPFS_GATEWAY_DOMAIN = 'drips.mypinata.cloud';
async function getIpfsFile(hash: IpfsHash): Promise<Response> {
  return fetch(`https://${IPFS_GATEWAY_DOMAIN}/ipfs/${hash}`);
}

export default async function getNftDriverMetadata(
  ipfsHash: IpfsHash,
): Promise<AnyVersion<typeof nftDriverAccountMetadataParser>> {
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = nftDriverAccountMetadataParser.parseAny(ipfsFile);

  return metadata;
}
