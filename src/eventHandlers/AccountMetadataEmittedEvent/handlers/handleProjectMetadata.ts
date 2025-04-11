/* eslint-disable no-param-reassign */ // Mutating Sequelize model instance is intentional and safe here.
import { type Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import { type z } from 'zod';
import { ProjectModel } from '../../../models';
import type { repoDriverAccountMetadataParser } from '../../../metadata/schemas';
import LogManager from '../../../core/LogManager';
import { calculateProjectStatus } from '../../../utils/projectUtils';
import type { IpfsHash, RepoDriverId } from '../../../core/types';
import {
  assertAddressDiverId,
  convertToRepoDriverId,
  isAddressDriverId,
  isNftDriverId,
  isRepoDriverId,
} from '../../../utils/accountIdUtils';
import unreachableError from '../../../utils/unreachableError';
import { getProjectMetadata } from '../../../utils/metadataUtils';
import verifySplitsReceivers from '../verifySplitsReceivers';
import verifyProjectSources from '../projectVerification';
import {
  createAddressReceiver,
  createDripListReceiver,
  createProjectReceiver,
  deleteExistingReceivers,
} from '../receiversRepository';
import type {
  addressDriverSplitReceiverSchema,
  repoDriverSplitReceiverSchema,
} from '../../../metadata/schemas/repo-driver/v2';
import type { dripListSplitReceiverSchema } from '../../../metadata/schemas/nft-driver/v2';

type Params = {
  ipfsHash: IpfsHash;
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: RepoDriverId;
};

export default async function handleProjectMetadata({
  ipfsHash,
  logManager,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: Params) {
  const metadata = await getProjectMetadata(ipfsHash);

  const [areSplitsValid, onChainSplitsHash, calculatedSplitsHash] =
    await verifySplitsReceivers(emitterAccountId, [
      ...metadata.splits.dependencies,
      ...metadata.splits.maintainers,
    ]);

  if (!areSplitsValid) {
    logManager.appendLog(
      `Skipped ${metadata.source.ownerName}/${metadata.source.repoName} (${emitterAccountId}) metadata processing: on-chain splits hash '${onChainSplitsHash}' does not match '${calculatedSplitsHash}' calculated from metadata.`,
    );

    return;
  }

  const projects = metadata.splits.dependencies
    .flatMap((s) => ('type' in s && s.type === 'repoDriver' ? [s] : []))
    .filter((dep) => dep.type === 'repoDriver');

  await verifyProjectSources(projects);

  await createProject({
    metadata,
    ipfsHash,
    logManager,
    transaction,
  });

  await deleteExistingReceivers({
    for: {
      accountId: emitterAccountId,
      column: 'funderProjectId',
    },
    transaction,
  });

  await setNewReceivers({
    logManager,
    transaction,
    blockTimestamp,
    emitterAccountId,
    receivers: metadata.splits,
  });
}

async function createProject({
  ipfsHash,
  metadata,
  logManager,
  transaction,
}: {
  ipfsHash: IpfsHash;
  logManager: LogManager;
  transaction: Transaction;
  metadata: AnyVersion<typeof repoDriverAccountMetadataParser>;
}): Promise<void> {
  const {
    color,
    source,
    description,
    describes: { accountId },
  } = metadata;

  const projectId = convertToRepoDriverId(accountId);

  function getEmoji(): string | null {
    if ('avatar' in metadata) {
      return metadata.avatar.type === 'emoji' ? metadata.avatar.emoji : null;
    }

    return metadata.emoji ?? null;
  }

  function getAvatarCid(): string | null {
    if ('avatar' in metadata && metadata.avatar.type === 'image') {
      return metadata.avatar.cid;
    }

    return null;
  }

  const projectProps = {
    id: projectId,
    color,
    url: source.url,
    description: description ?? null,
    verificationStatus: calculateProjectStatus({
      id: projectId,
      color,
      ownerAddress: null,
    }),
    isVisible: 'isVisible' in metadata ? metadata.isVisible : true, // Projects without `isVisible` field (V4 and below) are considered visible by default.
    lastProcessedIpfsHash: ipfsHash,
    emoji: getEmoji(),
    avatarCid: getAvatarCid(),
  };

  const [project, isCreated] = await ProjectModel.findOrCreate({
    transaction,
    lock: transaction.LOCK.UPDATE,
    where: { id: projectId },
    defaults: {
      ...projectProps,
      isValid: false, // Until the related `SplitsSet` is processed.
    },
  });

  if (isCreated) {
    logManager.appendFindOrCreateLog(ProjectModel, true, project.id);
  } else {
    project.set(projectProps);

    logManager.appendUpdateLog(project, ProjectModel, project.id);

    await project.save({ transaction });
  }
}

async function setNewReceivers({
  receivers,
  logManager,
  transaction,
  blockTimestamp,
  emitterAccountId,
}: {
  blockTimestamp: Date;
  logManager: LogManager;
  transaction: Transaction;
  emitterAccountId: RepoDriverId;
  receivers: AnyVersion<typeof repoDriverAccountMetadataParser>['splits'];
}) {
  const { dependencies, maintainers } = receivers;

  const maintainerPromises = maintainers.map((maintainer) => {
    assertAddressDiverId(maintainer.accountId);

    return createAddressReceiver({
      logManager,
      transaction,
      blockTimestamp,
      metadataReceiver: maintainer as z.infer<
        typeof addressDriverSplitReceiverSchema
      >, // Safe to cast because we already checked the type of accountId.
      funder: {
        type: 'project',
        dependencyType: 'maintainer',
        accountId: emitterAccountId,
      },
    });
  });

  const dependencyPromises = dependencies.map(async (dependency) => {
    if (isRepoDriverId(dependency.accountId)) {
      return createProjectReceiver({
        logManager,
        transaction,
        blockTimestamp,
        metadataReceiver: dependency as z.infer<
          typeof repoDriverSplitReceiverSchema
        >, // Safe to cast because we already checked the type of accountId.
        funder: {
          type: 'project',
          dependencyType: 'dependency',
          accountId: emitterAccountId,
        },
      });
    }

    if (isAddressDriverId(dependency.accountId)) {
      return createAddressReceiver({
        logManager,
        transaction,
        blockTimestamp,
        metadataReceiver: dependency as z.infer<
          typeof addressDriverSplitReceiverSchema
        >, // Safe to cast because we already checked the type of accountId.
        funder: {
          type: 'project',
          dependencyType: 'dependency',
          accountId: emitterAccountId,
        },
      });
    }

    if (isNftDriverId(dependency.accountId)) {
      // NFT Driver is always represents a DripList receiver for Projects. Ecosystem Main Account receivers are not yet supported for projects.
      return createDripListReceiver({
        logManager,
        transaction,
        blockTimestamp,
        metadataReceiver: dependency as z.infer<
          typeof dripListSplitReceiverSchema
        >, // Safe to cast because we already checked the type of accountId.,
        funder: {
          type: 'project',
          dependencyType: 'dependency',
          accountId: emitterAccountId,
        },
      });
    }

    return unreachableError(
      `Cannot process project dependency '${dependency.accountId}': unsupported Driver type.`,
    );
  });

  const result = await Promise.all([
    ...maintainerPromises,
    ...dependencyPromises,
  ]);

  logManager.appendLog(
    `Updated ${LogManager.nameOfType(ProjectModel)} with ID ${emitterAccountId} splits:\n${result
      .map((p) => `  - ${JSON.stringify(p)}`)
      .join('\n')}`,
  );
}
