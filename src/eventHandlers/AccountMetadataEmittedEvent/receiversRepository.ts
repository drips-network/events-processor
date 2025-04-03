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
  DripListSplitReceiverModel,
  GitProjectModel,
  RepoDriverSplitReceiverModel,
  SubListSplitReceiverModel,
} from '../../models';
import type LogManager from '../../core/LogManager';
import unreachableError from '../../utils/unreachableError';
import type {
  addressDriverSplitReceiverSchema,
  repoDriverSplitReceiverSchema,
} from '../../metadata/schemas/repo-driver/v2';
import {
  toAddressDriverId,
  toImmutableSplitsDriverId,
  toNftDriverId,
  toRepoDriverId,
} from '../../utils/accountIdUtils';
import getUserAddress from '../../utils/getAccountAddress';
import { AddressDriverSplitReceiverType } from '../../models/AddressDriverSplitReceiverModel';
import type { dripListSplitReceiverSchema } from '../../metadata/schemas/nft-driver/v2';
import type { subListSplitReceiverSchema } from '../../metadata/schemas/sub-list/v1';
import { FORGES_MAP } from '../../core/constants';
import { ProjectVerificationStatus } from '../../models/GitProjectModel';

export async function createAddressReceiver({
  blockTimestamp,
  funder,
  metadataReceiver,
  logManager,
  transaction,
}: {
  funder:
    | {
        type: 'project';
        accountId: RepoDriverId;
        dependencyType: 'dependency' | 'maintainer';
      }
    | { type: 'dripList'; accountId: NftDriverId }
    | { type: 'ecosystem'; accountId: NftDriverId }
    | { type: 'sub-list'; accountId: ImmutableSplitsDriverId };
  metadataReceiver: z.infer<typeof addressDriverSplitReceiverSchema>;
  transaction: Transaction;
  blockTimestamp: Date;
  logManager: LogManager;
}) {
  const { weight, accountId: fundeeAccountId } = metadataReceiver;

  const accountId = toAddressDriverId(fundeeAccountId);

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
  const [receiver, isReceiverCreated] =
    await AddressDriverSplitReceiverModel.findOrCreate({
      lock: true,
      transaction,
      where: {
        weight,
        fundeeAccountId: accountId,
        fundeeAccountAddress: getUserAddress(accountId),
        type,
        funderProjectId: funder.type === 'project' ? funder.accountId : null,
        funderDripListId: funder.type === 'dripList' ? funder.accountId : null,
      },
      defaults: {
        blockTimestamp,
        weight,
        fundeeAccountId: accountId,
        fundeeAccountAddress: getUserAddress(accountId),
        type,
        funderProjectId: funder.type === 'project' ? funder.accountId : null,
        funderDripListId: funder.type === 'dripList' ? funder.accountId : null,
      },
    });

  if (!isReceiverCreated) {
    unreachableError(
      `Sub List receiver ${receiver.id} already exists for sub-list ${accountId}. This means the receiver was created outside the expected flow.`,
    );
  }

  logManager.appendFindOrCreateLog(
    AddressDriverSplitReceiverModel,
    isReceiverCreated,
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
  funder:
    | { type: 'project'; accountId: RepoDriverId }
    | { type: 'dripList'; accountId: NftDriverId }
    | { type: 'ecosystem'; accountId: NftDriverId }
    | { type: 'sub-list'; accountId: ImmutableSplitsDriverId };
  metadataReceiver: z.infer<typeof dripListSplitReceiverSchema>;
  transaction: Transaction;
  blockTimestamp: Date;
  logManager: LogManager;
}) {
  const { weight, accountId: fundeeDripListId } = metadataReceiver;

  const dripListId = toNftDriverId(fundeeDripListId);

  // Create the receiver.
  const [receiver, isReceiverCreated] =
    await DripListSplitReceiverModel.findOrCreate({
      lock: true,
      transaction,
      where: {
        weight,
        type: DependencyType.DripListDependency,
        fundeeDripListId: dripListId,
        funderProjectId: funder.type === 'project' ? funder.accountId : null,
        funderSubListId: funder.type === 'sub-list' ? funder.accountId : null,
        funderDripListId: funder.type === 'dripList' ? funder.accountId : null,
        funderEcosystemId:
          funder.type === 'ecosystem' ? funder.accountId : null,
      },
      defaults: {
        blockTimestamp,
        weight,
        type: DependencyType.DripListDependency,
        fundeeDripListId: dripListId,
        funderProjectId: funder.type === 'project' ? funder.accountId : null,
        funderSubListId: funder.type === 'sub-list' ? funder.accountId : null,
        funderDripListId: funder.type === 'dripList' ? funder.accountId : null,
        funderEcosystemId:
          funder.type === 'ecosystem' ? funder.accountId : null,
      },
    });

  if (!isReceiverCreated) {
    unreachableError(
      `Drip List receiver ${receiver.id} already exists for sub-list ${dripListId}. This means the receiver was created outside the expected flow.`,
    );
  }

  logManager.appendFindOrCreateLog(
    DripListSplitReceiverModel,
    isReceiverCreated,
    receiver.id.toString(),
  );
}

export async function createSubListReceiver({
  blockTimestamp,
  funder,
  metadataReceiver,
  logManager,
  transaction,
}: {
  funder:
    | { type: 'project'; accountId: RepoDriverId }
    | { type: 'dripList'; accountId: NftDriverId }
    | { type: 'ecosystem'; accountId: NftDriverId }
    | { type: 'sub-list'; accountId: ImmutableSplitsDriverId };
  metadataReceiver: z.infer<typeof subListSplitReceiverSchema>;
  transaction: Transaction;
  blockTimestamp: Date;
  logManager: LogManager;
}) {
  const { weight, accountId: fundeeSubListId } = metadataReceiver;

  const subListId = toImmutableSplitsDriverId(fundeeSubListId);

  // Create the receiver.
  const [receiver, isReceiverCreated] =
    await SubListSplitReceiverModel.findOrCreate({
      lock: true,
      transaction,
      where: {
        weight,
        type: DependencyType.EcosystemDependency,
        fundeeSubListId: subListId,
        funderProjectId: funder.type === 'project' ? funder.accountId : null,
        funderSubListId: funder.type === 'sub-list' ? funder.accountId : null,
        funderDripListId: funder.type === 'dripList' ? funder.accountId : null,
        funderEcosystemId:
          funder.type === 'ecosystem' ? funder.accountId : null,
      },
      defaults: {
        weight,
        blockTimestamp,
        type: DependencyType.EcosystemDependency,
        fundeeSubListId: subListId,
        funderProjectId: funder.type === 'project' ? funder.accountId : null,
        funderSubListId: funder.type === 'sub-list' ? funder.accountId : null,
        funderDripListId: funder.type === 'dripList' ? funder.accountId : null,
        funderEcosystemId:
          funder.type === 'ecosystem' ? funder.accountId : null,
      },
    });

  if (!isReceiverCreated) {
    unreachableError(
      `Sub List receiver ${receiver.id} already exists for sub-list ${subListId}. This means the receiver was created outside the expected flow.`,
    );
  }

  logManager.appendFindOrCreateLog(
    SubListSplitReceiverModel,
    isReceiverCreated,
    receiver.id.toString(),
  );
}

export async function createProjectAndProjectReceiver({
  blockTimestamp,
  funder,
  metadataReceiver,
  logManager,
  transaction,
}: {
  funder:
    | { type: 'project'; accountId: RepoDriverId }
    | { type: 'dripList'; accountId: NftDriverId }
    | { type: 'ecosystem'; accountId: NftDriverId }
    | { type: 'sub-list'; accountId: ImmutableSplitsDriverId };
  metadataReceiver: z.infer<typeof repoDriverSplitReceiverSchema>;
  transaction: Transaction;
  blockTimestamp: Date;
  logManager: LogManager;
}) {
  const {
    weight,
    accountId: fundeeProjectId,
    source: { forge, ownerName, repoName, url },
  } = metadataReceiver;

  const projectId = toRepoDriverId(fundeeProjectId);

  // Create the project the receiver represents.
  const [project, isProjectCreated] = await GitProjectModel.findOrCreate({
    lock: true,
    transaction,
    where: {
      id: projectId,
    },
    defaults: {
      url,
      isVisible: true, // During creation, the project is visible by default. Account metadata will set the final visibility.
      isValid: true, // There are no receivers yet, so the project is valid.
      id: projectId,
      name: `${ownerName}/${repoName}`,
      verificationStatus: ProjectVerificationStatus.Unclaimed,
      forge:
        Object.values(FORGES_MAP).find(
          (f) => f.toLocaleLowerCase() === forge.toLowerCase(),
        ) ?? unreachableError(),
    },
  });

  logManager
    .appendFindOrCreateLog(GitProjectModel, isProjectCreated, project.id)
    .logAllInfo();

  let type: DependencyType;
  if (funder.type === 'project') {
    type = DependencyType.ProjectDependency;
  } else if (funder.type === 'dripList') {
    type = DependencyType.DripListDependency;
  } else {
    // TODO: For now we treat both ecosystem and sub-list cases as EcosystemDependency. Type will shortly be removed either way.
    type = DependencyType.EcosystemDependency;
  }

  // Create the receiver.
  const [receiver, isReceiverCreated] =
    await RepoDriverSplitReceiverModel.findOrCreate({
      lock: true,
      transaction,
      where: {
        weight,
        type,
        fundeeProjectId: projectId,
        funderProjectId: funder.type === 'project' ? funder.accountId : null,
        funderSubListId: funder.type === 'sub-list' ? funder.accountId : null,
        funderDripListId: funder.type === 'dripList' ? funder.accountId : null,
        funderEcosystemId:
          funder.type === 'ecosystem' ? funder.accountId : null,
      },
      defaults: {
        weight,
        type,
        blockTimestamp,
        fundeeProjectId: projectId,
        funderProjectId: funder.type === 'project' ? funder.accountId : null,
        funderSubListId: funder.type === 'sub-list' ? funder.accountId : null,
        funderDripListId: funder.type === 'dripList' ? funder.accountId : null,
        funderEcosystemId:
          funder.type === 'ecosystem' ? funder.accountId : null,
      },
    });

  if (!isReceiverCreated) {
    unreachableError(
      `Project receiver ${receiver.id} already exists for project ${projectId}. This means the receiver was created outside the expected flow.`,
    );
  }

  logManager.appendFindOrCreateLog(
    RepoDriverSplitReceiverModel,
    isReceiverCreated,
    receiver.id.toString(),
  );
}

type ClearReceiversInput =
  | { accountId: RepoDriverId; column: 'funderProjectId' }
  | { accountId: NftDriverId; column: 'funderDripListId' }
  | { accountId: NftDriverId; column: 'funderEcosystemId' }
  | { accountId: ImmutableSplitsDriverId; column: 'funderSubListId' };

type ClearReceiversParams = {
  for: ClearReceiversInput;
  transaction: Transaction;
  excludeReceivers?: AccountId[];
};

export async function deleteExistingReceivers({
  transaction,
  for: { accountId, column },
  excludeReceivers = [],
}: ClearReceiversParams): Promise<void> {
  const baseWhere = { [column]: accountId };

  const whereWithExclusions =
    excludeReceivers.length > 0
      ? {
          ...baseWhere,
          funderProjectId: { [Op.notIn]: excludeReceivers },
          funderSubListId: { [Op.notIn]: excludeReceivers },
          funderDripListId: { [Op.notIn]: excludeReceivers },
          funderEcosystemId: { [Op.notIn]: excludeReceivers },
        }
      : baseWhere;

  await AddressDriverSplitReceiverModel.destroy({
    where: whereWithExclusions,
    transaction,
  });

  await RepoDriverSplitReceiverModel.destroy({
    where: whereWithExclusions,
    transaction,
  });

  await DripListSplitReceiverModel.destroy({
    where: whereWithExclusions,
    transaction,
  });

  await SubListSplitReceiverModel.destroy({
    where: whereWithExclusions,
    transaction,
  });
}
