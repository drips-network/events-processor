import z from 'zod';
import { addressDriverSplitReceiverSchema } from '../repo-driver/v2';
import { dripListSplitReceiverSchema } from '../nft-driver/v2';
import { repoSubAccountDriverSplitReceiverSchema } from '../common/repoSubAccountDriverSplitReceiverSchema';
import { deadlineSplitReceiverSchema } from '../repo-driver/v6';
import { subListSplitReceiverSchema, subListMetadataSchemaV1 } from './v1';

export const subListMetadataSchemaV2 = subListMetadataSchemaV1.extend({
  recipients: z.array(
    z.union([
      addressDriverSplitReceiverSchema,
      dripListSplitReceiverSchema,
      repoSubAccountDriverSplitReceiverSchema,
      subListSplitReceiverSchema,
      deadlineSplitReceiverSchema, // New in v2
    ]),
  ),
  isVisible: z.boolean().optional(),
});
