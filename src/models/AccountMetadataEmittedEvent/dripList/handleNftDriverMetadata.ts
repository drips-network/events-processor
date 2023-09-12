import type { Transaction } from 'sequelize';
import type { UUID } from 'crypto';
import type { DripListId, KnownAny } from '../../../common/types';
import getNftDriverMetadata from './getNftDriverMetadata';
import DripListModel from '../../DripListModel';
import { logRequestDebug } from '../../../utils/logRequest';
import validateDripListMetadata from './validateDripListMetadata';
import createDbEntriesForDripListSplits from './createDbEntriesForDripListSplits';
import TransferEventModel from '../../TransferEvent/TransferEventModel';
import IsDripList from '../../TransferEvent/isDripList';

export default async function handleNftDriverMetadata(
  dripListId: DripListId,
  transaction: Transaction,
  requestId: UUID,
  ipfsHashBytes: string,
): Promise<void> {
  const transferEvent = await TransferEventModel.findOne({
    where: { tokenId: dripListId },
    transaction,
    lock: true,
  });

  if (!transferEvent) {
    throw new Error(
      `Transfer event with (token) ID ${dripListId} was not found, but it was expected to exist. The event that should have created the project may not have been processed yet.`,
    );
  }

  const ownerAddress = transferEvent.to;

  const totalOwnerNftAccounts = await TransferEventModel.count({
    where: {
      to: ownerAddress,
    },
    transaction,
  });

  if (!(await IsDripList(dripListId, totalOwnerNftAccounts, ownerAddress))) {
    return;
  }

  const dripList = await DripListModel.findByPk(dripListId, {
    transaction,
    lock: true,
  });

  if (!dripList) {
    const errorMessage = `Drip List with (token) ID ${dripListId} was not found, but it was expected to exist. The event that should have created the project may not have been processed yet.`;

    logRequestDebug(errorMessage, requestId);
    throw new Error(errorMessage);
  }

  const metadata = await getNftDriverMetadata(dripListId, ipfsHashBytes);

  validateDripListMetadata(dripList, metadata);

  const { name, projects } = metadata;

  dripList.name = name ?? null;

  await dripList.save({ transaction, requestId } as KnownAny); // `as any` to avoid TS complaining about passing in the `requestId`.

  await createDbEntriesForDripListSplits(
    dripList.tokenId,
    projects,
    requestId,
    transaction,
  );
}
