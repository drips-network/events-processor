import type { AnyVersion } from '@efstajas/versioned-parser';
import type { ProjectId } from '../../../common/types';
import { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import { createIpfsHash, getIpfsFile } from '../../../utils/ipfs';

export default async function getProjectMetadata(
  id: ProjectId,
  ipfsHashBytes: string,
): Promise<AnyVersion<typeof repoDriverAccountMetadataParser>> {
  const ipfsHash = createIpfsHash(ipfsHashBytes);
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = repoDriverAccountMetadataParser.parseAny(ipfsFile);

  if (!metadata) {
    throw new Error(
      `Project metadata not found for Git Project with ID ${id} but it was expected to exist.`,
    );
  }

  return metadata;
}