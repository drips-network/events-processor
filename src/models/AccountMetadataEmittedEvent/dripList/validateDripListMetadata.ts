import type { AnyVersion } from '@efstajas/versioned-parser';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import type DripListModel from '../../DripListModel';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';

export default function validateDripListMetadata(
  dripList: DripListModel,
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): void {
  if (!metadata) {
    throw new Error(
      `Drip List metadata not found for Drip List with (token) ID ${dripList.tokenId} but it was expected to exist.`,
    );
  }

  const errors = [];

  const { describes, isDripList } = metadata;
  const { tokenId: dripListId } = dripList;

  if (describes.accountId !== dripListId) {
    errors.push(
      `accountId mismatch with: got ${describes.accountId}, expected ${dripListId}`,
    );
  }

  if (!isDripList) {
    shouldNeverHappen(
      `isDripList mismatch with: got ${isDripList}, expected true`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Git Project with ID ${dripListId} has metadata that does not match the metadata emitted by the contract (${errors.join(
        '; ',
      )}).`,
    );
  }
}
