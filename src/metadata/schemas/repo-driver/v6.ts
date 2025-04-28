import { repoDriverAccountMetadataSchemaV5 } from './v5';

export const repoDriverAccountMetadataSchemaV6 =
  repoDriverAccountMetadataSchemaV5.omit({
    description: true,
  });
