import type { Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import type { DripListId } from '../../../common/types';
import getNftDriverMetadata from './getNftDriverMetadata';
import validateDripListMetadata from './validateDripListMetadata';
import DripListModel from '../../../models/DripListModel';
import type { nftDriverAccountMetadataParser } from '../../../metadata/schemas';
import getChangedProperties from '../../../utils/getChangedProperties';

export default async function updateDripListMetadata(
  dripListId: DripListId,
  transaction: Transaction,
  logs: string[],
  ipfsHashBytes: string,
): Promise<AnyVersion<typeof nftDriverAccountMetadataParser>> {
  const dripList = await DripListModel.findByPk(dripListId, {
    transaction,
    lock: true,
  });

  if (!dripList) {
    throw new Error(
      `Drip List with (token) ID ${dripListId} was not found, but it was expected to exist. The event that should have created the Drip List may not have been processed yet.`,
    );
  }

  const metadata = await getNftDriverMetadata(dripListId, ipfsHashBytes);

  validateDripListMetadata(dripList, metadata);

  const { name, projects } = metadata;

  dripList.name = name ?? null;
  dripList.projectsJson = JSON.stringify(projects);

  logs.push(
    `Incoming event was the latest for Drip List with ID ${dripListId}. The Drip List metadata was updated: ${JSON.stringify(
      getChangedProperties(dripList),
    )}.`,
  );

  await dripList.save({ transaction });

  return metadata;
}
