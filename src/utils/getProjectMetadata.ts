import type { AnyVersion } from '@efstajas/versioned-parser';
import getIpfsFile from './getIpfsFile';
import type { IpfsHash } from '../common/types';
import { repoDriverAccountMetadataParser } from '../metadata/schemas';

export default async function getProjectMetadata(
  ipfsHash: IpfsHash,
): Promise<AnyVersion<typeof repoDriverAccountMetadataParser> | null> {
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();

  const metadata = repoDriverAccountMetadataParser.parseAny(ipfsFile);

  return metadata;
}
