import type { AnyVersion } from '@efstajas/versioned-parser';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';
import type { TransferEventModel } from '../../../models';

export default async function validateDripListMetadata(
  dripListTransferEvent: TransferEventModel,
  metadata: AnyVersion<typeof nftDriverAccountMetadataParser>,
): Promise<void> {
  const errors = [];

  const { describes, isDripList } = metadata;
  const { tokenId: dripListId } = dripListTransferEvent;

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
