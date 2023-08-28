import type { IpfsHash } from '../common/types';

const IPFS_GATEWAY_DOMAIN = 'drips.mypinata.cloud';

export default async function getIpfsFile(hash: IpfsHash): Promise<Response> {
  return fetch(`https://${IPFS_GATEWAY_DOMAIN}/ipfs/${hash}`);
}
