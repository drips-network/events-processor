const IPFS_GATEWAY_DOMAIN = 'drips.mypinata.cloud';

export default async function fetchIpfs(hash: string) {
  return fetch(`https://${IPFS_GATEWAY_DOMAIN}/ipfs/${hash}`);
}
