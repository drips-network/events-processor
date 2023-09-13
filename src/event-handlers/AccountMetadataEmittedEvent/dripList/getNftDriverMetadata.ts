import type { AnyVersion } from '@efstajas/versioned-parser';
import type { NftDriverAccountId } from '../../../common/types';
import { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import { createIpfsHash, getIpfsFile } from '../../../utils/ipfs';

export default async function getNftDriverMetadata(
  id: NftDriverAccountId,
  ipfsHashBytes: string,
): Promise<AnyVersion<typeof nftDriverAccountMetadataParser>> {
  const ipfsHash = createIpfsHash(ipfsHashBytes);
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = nftDriverAccountMetadataParser.parseAny(ipfsFile);

  if (!metadata) {
    throw new Error(
      `Project metadata not found for Nft account with ID ${id} but it was expected to exist.`,
    );
  }

  return metadata;
}
