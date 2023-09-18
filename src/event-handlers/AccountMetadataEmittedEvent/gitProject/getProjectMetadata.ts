import type { AnyVersion } from '@efstajas/versioned-parser';
import { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import { createIpfsHash, getIpfsFile } from '../../../utils/ipfs';

export default async function getProjectMetadata(
  ipfsHashBytes: string,
): Promise<AnyVersion<typeof repoDriverAccountMetadataParser>> {
  const ipfsHash = createIpfsHash(ipfsHashBytes);
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = repoDriverAccountMetadataParser.parseAny(ipfsFile);

  return metadata;
}
