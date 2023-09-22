import { ethers } from 'ethers';
import type { IpfsHash } from '../common/types';

const IPFS_GATEWAY_DOMAIN = 'drips.mypinata.cloud';

export async function getIpfsFile(hash: IpfsHash): Promise<Response> {
  return fetch(`https://${IPFS_GATEWAY_DOMAIN}/ipfs/${hash}`);
}

export function createIpfsHash(str: string): IpfsHash {
  const ipfsHash = ethers.toUtf8String(str);

  const isIpfsHash = /^(Qm[a-zA-Z0-9]{44})$/.test(ipfsHash);

  if (!isIpfsHash) {
    throw new Error('The provided string is not a valid IPFS hash.');
  }

  return ipfsHash as IpfsHash;
}
