import type { AnyVersion } from '@efstajas/versioned-parser';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';
import type { DripListModel } from '../../../models';

export default async function validateDripListMetadata(
  dripList: DripListModel,
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): Promise<void> {
  if (!metadata) {
    throw new Error(
      `Drip List metadata not found for Drip List with (token) ID ${dripList.id} but it was expected to exist.`,
    );
  }

  const errors = [];

  const { describes, isDripList } = metadata;
  const { id: dripListId } = dripList;

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
      `Drip List with ID ${dripListId} has metadata that does not match the metadata emitted by the contract (${errors.join(
        '; ',
      )}).`,
    );
  }
}
