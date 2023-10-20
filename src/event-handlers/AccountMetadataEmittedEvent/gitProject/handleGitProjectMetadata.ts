/* eslint-disable no-param-reassign */
import type { Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import {
  AddressDriverSplitReceiverModel,
  GitProjectModel,
  RepoDriverSplitReceiverModel,
} from '../../../models';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import LogManager from '../../../common/LogManager';
import { calculateProjectStatus } from '../../../utils/gitProjectUtils';
import type { IpfsHash, ProjectId } from '../../../common/types';
import {
  assertAddressDiverId,
  isAddressDriverId,
  isNftDriverId,
  isRepoDiverId,
} from '../../../utils/accountIdUtils';
import { AddressDriverSplitReceiverType } from '../../../models/AddressDriverSplitReceiverModel';
import { assertDependencyOfProjectType } from '../../../utils/assert';
import createDbEntriesForProjectDependency from '../createDbEntriesForProjectDependency';
import shouldNeverHappen from '../../../utils/shouldNeverHappen';
import { getProjectMetadata } from '../../../utils/metadataUtils';
import validateProjectMetadata from './validateProjectMetadata';
import areReceiversValid from '../splitsValidator';
import getUserAddress from '../../../utils/get-account-address';
import logger from '../../../common/logger';

export default async function handleGitProjectMetadata(
  logManager: LogManager,
  projectId: ProjectId,
  transaction: Transaction,
  ipfsHash: IpfsHash,
) {
  const project = await GitProjectModel.findByPk(projectId, {
    transaction,
    lock: true,
  });

  if (!project) {
    throw new Error(
      `Failed to update the metadata of Git Project with ID ${projectId}: the project does not exist in the database. 
      This is normal if the event that should have created the project was not processed yet. 
      If the error persists, ensure the account metadata are not manually emitted. 
      Check the logs for more information on the result of the operation.`,
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
  );
}

async function updateGitProjectMetadata(
  project: GitProjectModel,
  logManager: LogManager,
  transaction: Transaction,
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>,
): Promise<void> {
  const { color, emoji, source, description } = metadata;

  project.color = color;
  project.emoji = emoji;
  project.url = source.url;
  project.ownerName = source.ownerName;
  project.repoName = source.repoName;
  project.description = description ?? null;
  project.splitsJson = JSON.stringify(metadata.splits);
  project.verificationStatus = calculateProjectStatus(project);

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
    if (isRepoDiverId(dependency.accountId)) {
      assertDependencyOfProjectType(dependency);

      return createDbEntriesForProjectDependency(
        funderProjectId,
        dependency,
        transaction,
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
      logger.warn(
        `Dependency with account ID ${dependency.accountId} is not an Address nor a Git Project.`,
      );

      return Promise.resolve();
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
}
