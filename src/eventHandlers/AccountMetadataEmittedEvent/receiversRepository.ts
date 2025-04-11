import { Op, type Transaction } from 'sequelize';
import type { z } from 'zod';
import { DependencyType } from '../../core/types';
import type {
  AccountId,
  ImmutableSplitsDriverId,
  NftDriverId,
  RepoDriverId,
} from '../../core/types';
import {
  AddressDriverSplitReceiverModel,
  DripListModel,
  DripListSplitReceiverModel,
  ProjectModel,
  RepoDriverSplitReceiverModel,
  StreamReceiverSeenEventModel,
  SubListModel,
  SubListSplitReceiverModel,
} from '../../models';
import type LogManager from '../../core/LogManager';
import type {
  addressDriverSplitReceiverSchema,
  repoDriverSplitReceiverSchema,
} from '../../metadata/schemas/repo-driver/v2';
import {
  assertIsAccountId,
  convertToAddressDriverId,
  convertToImmutableSplitsDriverId,
  convertToNftDriverId,
  convertToRepoDriverId,
} from '../../utils/accountIdUtils';
import getUserAddress from '../../utils/getAccountAddress';
import { AddressDriverSplitReceiverType } from '../../models/AddressDriverSplitReceiverModel';
import type { dripListSplitReceiverSchema } from '../../metadata/schemas/nft-driver/v2';
import type { subListSplitReceiverSchema } from '../../metadata/schemas/immutable-splits-driver/v1';
import type { Funder } from './buildFunderAccountFields';
import buildFunderAccountFields, {
  resolveDependencyType,
} from './buildFunderAccountFields';
import RecoverableError from '../../utils/recoverableError';
import {
  calculateProjectStatus,
  METADATA_FORGE_MAP,
} from '../../utils/projectUtils';

export async function createAddressReceiver({
  funder,
  logManager,
  transaction,
  blockTimestamp,
  metadataReceiver,
}: {
  funder: Funder;
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  metadataReceiver: z.infer<typeof addressDriverSplitReceiverSchema>;
}) {
  const { weight, accountId } = metadataReceiver;

  const fundeeAccountId = convertToAddressDriverId(accountId);

  let type: AddressDriverSplitReceiverType;
  if (funder.type === 'project') {
    type =
      funder.dependencyType === 'dependency'
        ? AddressDriverSplitReceiverType.ProjectDependency
        : AddressDriverSplitReceiverType.ProjectMaintainer;
  } else if (funder.type === 'dripList') {
    type = AddressDriverSplitReceiverType.DripListDependency;
  } else {
    // TODO: For now we treat both ecosystem and sub-list cases as EcosystemDependency. Type will shortly be removed either way.
    type = AddressDriverSplitReceiverType.EcosystemDependency;
  }

  // Create the receiver.
  const receiver = await AddressDriverSplitReceiverModel.create(
    {
      type,
      weight,
      blockTimestamp,
      fundeeAccountId,
      ...buildFunderAccountFields(funder),
      fundeeAccountAddress: getUserAddress(accountId),
    },
    { transaction },
  );

  logManager.appendFindOrCreateLog(
    AddressDriverSplitReceiverModel,
    true,
    receiver.id.toString(),
  );
}

export async function createDripListReceiver({
  blockTimestamp,
  funder,
  metadataReceiver,
  logManager,
  transaction,
}: {
  funder: Funder;
  metadataReceiver: z.infer<typeof dripListSplitReceiverSchema>;
  transaction: Transaction;
  blockTimestamp: Date;
  logManager: LogManager;
}) {
  const { weight, accountId } = metadataReceiver;
  const fundeeDripListId = convertToNftDriverId(accountId);

  const dripList = await DripListModel.findByPk(fundeeDripListId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!dripList) {
    throw new RecoverableError(
      `Drip List ${fundeeDripListId} not found. Likely waiting on 'AccountMetadata' event to be processed. Retrying, but if this persists, it is a real error.`,
    );
  }

  const receiver = await DripListSplitReceiverModel.create(
    {
      weight,
      fundeeDripListId,
      type: resolveDependencyType(funder),
      ...buildFunderAccountFields(funder),
      blockTimestamp,
    },
    {
      transaction,
    },
  );

  logManager.appendFindOrCreateLog(
    DripListSplitReceiverModel,
    true,
    receiver.id.toString(),
  );
}

export async function createSubListReceiver({
  funder,
  logManager,
  transaction,
  blockTimestamp,
  metadataReceiver,
}: {
  funder: Funder;
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  metadataReceiver: z.infer<typeof subListSplitReceiverSchema>;
}) {
  const { weight, accountId } = metadataReceiver;
  const fundeeSubListId = convertToImmutableSplitsDriverId(accountId);

  const [subList, isCreated] = await SubListModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: {
      id: fundeeSubListId,
    },
    defaults: {
      id: fundeeSubListId,
      isValid: false, // Until the related Sub List's metadata is processed.
    },
  });

  logManager.appendFindOrCreateLog(SubListModel, isCreated, subList.id);

  const receiver = await SubListSplitReceiverModel.create(
    {
      weight,
      blockTimestamp,
      fundeeSubListId,
      type: DependencyType.EcosystemDependency, // All sub-list receivers are ecosystem dependencies (soon to be removed).
      ...buildFunderAccountFields(funder),
    },
    { transaction },
  );

  logManager.appendFindOrCreateLog(
    SubListSplitReceiverModel,
    true,
    receiver.id.toString(),
  );
}

export async function createProjectReceiver({
  funder,
  logManager,
  transaction,
  blockTimestamp,
  metadataReceiver,
}: {
  funder: Funder;
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  metadataReceiver: z.infer<typeof repoDriverSplitReceiverSchema>;
}) {
  const {
    weight,
    accountId,
    source: { url, ownerName, repoName, forge },
  } = metadataReceiver;
  const fundeeProjectId = convertToRepoDriverId(accountId);

  const [project, isCreated] = await ProjectModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: {
      id: fundeeProjectId,
    },
    defaults: {
      id: fundeeProjectId,
      url,
      isVisible: true, // Default to visible on creation. Final visibility will be determined by account metadata.
      isValid: true, // The project is valid by default since there are no receivers yet.
      name: `${ownerName}/${repoName}`,
      verificationStatus: calculateProjectStatus({
        id: fundeeProjectId,
        color: null,
        ownerAddress: null,
      }),
      forge: METADATA_FORGE_MAP[forge],
    },
  });

  logManager.appendFindOrCreateLog(ProjectModel, isCreated, project.id);

  const receiver = await RepoDriverSplitReceiverModel.create(
    {
      weight,
      fundeeProjectId,
      type: resolveDependencyType(funder),
      ...buildFunderAccountFields(funder),
      blockTimestamp,
    },
    { transaction },
  );

  logManager.appendFindOrCreateLog(
    RepoDriverSplitReceiverModel,
    true,
    receiver.id.toString(),
  );
}

type ClearReceiversInput =
  | { accountId: RepoDriverId; column: 'funderProjectId' }
  | { accountId: NftDriverId; column: 'funderDripListId' }
  | { accountId: NftDriverId; column: 'funderEcosystemMainAccountId' }
  | { accountId: ImmutableSplitsDriverId; column: 'funderSubListId' };

type ClearReceiversParams = {
  for: ClearReceiversInput;
  transaction: Transaction;
  excludeReceivers?: AccountId[];
};

export async function deleteExistingReceivers({
  transaction,
  for: { accountId, column },
}: ClearReceiversParams): Promise<void> {
  const where = { [column]: accountId };

  await AddressDriverSplitReceiverModel.destroy({
    where,
    transaction,
  });

  await RepoDriverSplitReceiverModel.destroy({
    where,
    transaction,
  });

  await DripListSplitReceiverModel.destroy({
    where,
    transaction,
  });

  await SubListSplitReceiverModel.destroy({
    where,
    transaction,
  });
}

export async function getCurrentSplitsByAccountId(
  emitterAccountId: bigint,
): Promise<AccountId[]> {
  assertIsAccountId(emitterAccountId);

  const addressSplits = await AddressDriverSplitReceiverModel.findAll({
    where: {
      [Op.or]: [
        { funderProjectId: emitterAccountId },
        { funderDripListId: emitterAccountId },
        { funderEcosystemMainAccountId: emitterAccountId },
        { funderSubListId: emitterAccountId },
      ],
    },
    lock: true,
  });

  const dripListSplits = await DripListSplitReceiverModel.findAll({
    where: {
      [Op.or]: [
        { funderProjectId: emitterAccountId },
        { funderDripListId: emitterAccountId },
        { funderEcosystemMainAccountId: emitterAccountId },
        { funderSubListId: emitterAccountId },
      ],
    },
    lock: true,
  });

  const projectSplits = await RepoDriverSplitReceiverModel.findAll({
    where: {
      [Op.or]: [
        { funderProjectId: emitterAccountId },
        { funderDripListId: emitterAccountId },
        { funderEcosystemMainAccountId: emitterAccountId },
        { funderSubListId: emitterAccountId },
      ],
    },
    lock: true,
  });

  const subListSplits = await SubListSplitReceiverModel.findAll({
    where: {
      [Op.or]: [
        { funderProjectId: emitterAccountId },
        { funderDripListId: emitterAccountId },
        { funderEcosystemMainAccountId: emitterAccountId },
        { funderSubListId: emitterAccountId },
      ],
    },
    lock: true,
  });

  const accountIds = [
    ...addressSplits.map((receiver) => receiver.fundeeAccountId),
    ...dripListSplits.map((receiver) => receiver.fundeeDripListId),
    ...projectSplits.map((receiver) => receiver.fundeeProjectId),
    ...subListSplits.map((receiver) => receiver.fundeeSubListId),
  ];

  return Array.from(new Set(accountIds));
}

export async function getCurrentSplitsByReceiversHash(
  receiversHash: string,
): Promise<AccountId[]> {
  const streamReceiverSeenEvents = await StreamReceiverSeenEventModel.findAll({
    where: {
      receiversHash,
    },
    lock: true,
  });

  const accountIds = streamReceiverSeenEvents.map((event) => event.accountId);

  return Array.from(new Set(accountIds));
}
