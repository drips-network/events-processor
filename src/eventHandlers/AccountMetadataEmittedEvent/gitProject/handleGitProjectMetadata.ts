/* eslint-disable no-param-reassign */
import type { Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import {
  AddressDriverSplitReceiverModel,
  DripListSplitReceiverModel,
  GitProjectModel,
  RepoDriverSplitReceiverModel,
} from '../../../models';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import LogManager from '../../../core/LogManager';
import { calculateProjectStatus } from '../../../utils/gitProjectUtils';
import {
  DependencyType,
  type IpfsHash,
  type ProjectId,
} from '../../../core/types';
import {
  assertAddressDiverId,
  isAddressDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../../utils/accountIdUtils';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';
import { assertDependencyOfProjectType } from '../../../utils/assert';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';
import { getProjectMetadata } from '../../../utils/metadataUtils';
import validateProjectMetadata from './validateProjectMetadata';
import areReceiversValid from '../splitsValidator';
import getUserAddress from '../../../utils/getAccountAddress';

export default async function handleGitProjectMetadata(
  logManager: LogManager,
  projectId: ProjectId,
  transaction: Transaction,
  ipfsHash: IpfsHash,
  blockTimestamp: Date,
) {
  const project = await GitProjectModel.findByPk(projectId, {
    transaction,
    lock: true,
  });

  if (!project) {
    throw new Error(
      `Failed to update metadata for Project with ID ${projectId}: Project not found.
      \r Possible reasons:
      \r\t - The event that should have created the Project was not processed yet.
      \r\t - The metadata were manually emitted.`,
    );
  }

  const metadata = await getProjectMetadata(ipfsHash);

  await validateProjectMetadata(project, metadata);

  await updateGitProjectMetadata(project, logManager, transaction, metadata);

  await createDbEntriesForProjectSplits(
    projectId,
    metadata.splits,
    logManager,
    transaction,
    blockTimestamp,
  );
}

async function updateGitProjectMetadata(
  project: GitProjectModel,
  logManager: LogManager,
  transaction: Transaction,
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
): Promise<void> {
  const { color, source, description } = metadata;

  project.color = color;
  project.url = source.url;
  project.description = description ?? null;
  project.verificationStatus = calculateProjectStatus(project);

  if ('avatar' in metadata) {
    // Metadata V4

    if (metadata.avatar.type === 'emoji') {
      project.emoji = metadata.avatar.emoji;
      project.avatarCid = null;
    } else if (metadata.avatar.type === 'image') {
      project.avatarCid = metadata.avatar.cid;
      project.emoji = null;
    }
  } else {
    // Metadata V3

    project.emoji = metadata.emoji;
  }

  const isValid = await areReceiversValid(
    project.id,
    metadata.splits.dependencies
      .concat(metadata.splits.maintainers as any)
      .map((s) => ({
        weight: s.weight,
        accountId: s.accountId,
      })),
  );

  project.isValid = isValid;

  if (!isValid) {
    logManager.appendLog(
      `Set the Git Project to 'invalid' because the hash of the metadata receivers did not match the hash of the on-chain receivers for project with ID ${project.id}. 
      This means that the processed event was the latest in the database but not the latest on-chain. 
      Check the 'isValid' flag to see if the project is valid after all the events are processed.`,
    );
  }

  logManager.appendUpdateLog(project, GitProjectModel, project.id);

  await project.save({ transaction });
}

async function createDbEntriesForProjectSplits(
  funderProjectId: ProjectId,
  splits: AnyVersion<typeof repoDriverAccountMetadataParser>['splits'],
  logManager: LogManager,
  transaction: Transaction,
  blockTimestamp: Date,
) {
  await clearCurrentProjectSplits(funderProjectId, transaction);

  const { dependencies, maintainers } = splits;

  const maintainerPromises = maintainers.map((maintainer) => {
    assertAddressDiverId(maintainer.accountId);

    return AddressDriverSplitReceiverModel.create(
      {
        funderProjectId,
        weight: maintainer.weight,
        fundeeAccountId: maintainer.accountId,
        fundeeAccountAddress: getUserAddress(maintainer.accountId),
        type: AddressDriverSplitReceiverType.ProjectMaintainer,
      },
      { transaction },
    );
  });

  const dependencyPromises = dependencies.map(async (dependency) => {
    if (isRepoDriverId(dependency.accountId)) {
      assertDependencyOfProjectType(dependency);

      return createDbEntriesForProjectDependency(
        funderProjectId,
        dependency,
        transaction,
        blockTimestamp,
      );
    }

    if (isAddressDriverId(dependency.accountId)) {
      return AddressDriverSplitReceiverModel.create(
        {
          funderProjectId,
          weight: dependency.weight,
          fundeeAccountId: dependency.accountId,
          fundeeAccountAddress: getUserAddress(dependency.accountId),
          type: AddressDriverSplitReceiverType.ProjectDependency,
        },
        { transaction },
      );
    }

    if (isNftDriverId(dependency.accountId)) {
      return DripListSplitReceiverModel.create(
        {
          funderProjectId,
          fundeeDripListId: dependency.accountId,
          weight: dependency.weight,
          type: DependencyType.ProjectDependency,
          blockTimestamp,
        },
        { transaction },
      );
    }

    return shouldNeverHappen(
      `Dependency with account ID ${dependency.accountId} is not an Address nor a Git Project.`,
    );
  });

  const result = await Promise.all([
    ...maintainerPromises,
    ...dependencyPromises,
  ]);

  logManager.appendLog(
    `Updated ${LogManager.nameOfType(
      GitProjectModel,
    )} with ID ${funderProjectId} splits: ${result
      .map((p) => JSON.stringify(p))
      .join(`, `)}
    `,
  );
}

async function clearCurrentProjectSplits(
  funderProjectId: string,
  transaction: Transaction,
) {
  await AddressDriverSplitReceiverModel.destroy({
    where: {
      funderProjectId,
    },
    transaction,
  });
  await RepoDriverSplitReceiverModel.destroy({
    where: {
      funderProjectId,
    },
    transaction,
  });
  await DripListSplitReceiverModel.destroy({
    where: {
      funderProjectId,
    },
    transaction,
  });
}
