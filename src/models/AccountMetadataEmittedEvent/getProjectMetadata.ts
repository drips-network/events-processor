import type { AnyVersion } from '@efstajas/versioned-parser';
import { repoDriverAccountMetadataParser } from '../../metadata/schemas';
import type { ProjectId } from '../../common/types';
import { getIpfsFile, createIpfsHash } from '../../utils/ipfs';

export default async function getProjectMetadata(
  id: ProjectId,
  ipfsHashBytes: string,
): Promise<AnyVersion<typeof repoDriverAccountMetadataParser>> {
  const ipfsHash = createIpfsHash(ipfsHashBytes);
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = repoDriverAccountMetadataParser.parseAny(ipfsFile);

  if (!metadata) {
    throw new Error(
      `Project metadata not found for Git project with ID ${id} but it was expected to exist.`,
    );
  }

  return metadata;
}
