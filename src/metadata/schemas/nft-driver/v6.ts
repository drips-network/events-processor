import { z } from 'zod';
import { nftDriverAccountMetadataSchemaV5 } from './v5';
import {
  addressDriverSplitReceiverSchema,
  repoDriverSplitReceiverSchema,
} from '../repo-driver/v2';
import { subListSplitReceiverSchema } from '../sub-list/v1';
import { dripListSplitReceiverSchema } from './v2';

const base = nftDriverAccountMetadataSchemaV5.extend({
  isDripList: z.undefined().optional(),
  projects: z.undefined().optional(),
});

const ecosystemVariant = base.extend({
  type: z.literal('ecosystem'),
  recipients: z.array(
    z.union([repoDriverSplitReceiverSchema, subListSplitReceiverSchema]),
  ),
});

const dripListVariant = base.extend({
  type: z.literal('dripList'),
  recipients: z.array(
    z.union([
      repoDriverSplitReceiverSchema,
      subListSplitReceiverSchema,
      addressDriverSplitReceiverSchema,
      dripListSplitReceiverSchema,
    ]),
  ),
});

export const nftDriverAccountMetadataSchemaV6 = z.discriminatedUnion('type', [
  ecosystemVariant,
  dripListVariant,
]);
