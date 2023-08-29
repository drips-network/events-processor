import type { CreateOptions, InferAttributes } from 'sequelize';
import type { UUID } from 'crypto';
import { ethers } from 'ethers';
import AccountMetadataEmittedEventModel from './AccountMetadataEmittedEventModel';
import assertTransaction from '../../utils/assert';
import { USER_METADATA_KEY } from '../../common/constants';
import validateGitProjectMetadata from './validateProjectMetadata';
import type GitProjectModel from '../GitProjectModel/GitProjectModel';
import { ProjectVerificationStatus } from '../GitProjectModel/GitProjectModel';
import getIpfsFile from '../../utils/getIpfsFile';
import { repoDriverAccountMetadataParser } from '../../metadata/schemas';
import retryFindGitProject from '../../utils/retryFindGitProject';

export default async function updateGitProjectMetadata(
  newInstance: AccountMetadataEmittedEventModel,
  options: CreateOptions<
    InferAttributes<
      AccountMetadataEmittedEventModel,
      {
        omit: never;
      }
    >
  > & { requestId: UUID },
): Promise<void> {
  const { accountId } = newInstance;
  const { transaction, requestId } = options;

  assertTransaction(transaction);

  const gitProject: GitProjectModel = await retryFindGitProject(
    requestId,
    accountId,
    transaction,
  );

  let latestAccountMetadataEmittedEvent =
    (await AccountMetadataEmittedEventModel.findOne({
      where: {
        accountId,
        key: USER_METADATA_KEY,
      },
      order: [
        ['blockNumber', 'DESC'],
        ['logIndex', 'DESC'],
      ],
      transaction,
    })) ?? newInstance;

  if (
    newInstance.blockNumber > latestAccountMetadataEmittedEvent.blockNumber ||
    (newInstance.blockNumber ===
      latestAccountMetadataEmittedEvent.blockNumber &&
      newInstance.logIndex > latestAccountMetadataEmittedEvent.logIndex)
  ) {
    latestAccountMetadataEmittedEvent = newInstance;
  }

  const ipfsHash = ethers.toUtf8String(latestAccountMetadataEmittedEvent.value);
  const ipfsFile = await (await getIpfsFile(ipfsHash)).json();
  const metadata = repoDriverAccountMetadataParser.parseAny(ipfsFile);

  if (!metadata) {
    throw new Error(
      `Project metadata not found for Git project with account ID ${accountId} but it was expected to exist.`,
    );
  }

  validateGitProjectMetadata(gitProject, metadata);

  await gitProject.update(
    {
      color: metadata.color,
      emoji: metadata.emoji,
      url: metadata.source.url,
      description: metadata.description,
      ownerName: metadata.source.ownerName,
      verificationStatus: ProjectVerificationStatus.Claimed,
    },
    {
      transaction,
      requestId,
    } as any,
  );
}
