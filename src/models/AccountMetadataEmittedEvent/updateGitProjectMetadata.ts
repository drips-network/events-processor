import type { Transaction } from 'sequelize';
import type { AnyVersion } from '@efstajas/versioned-parser';
import { ethers } from 'ethers';
import type { UUID } from 'crypto';
import type { AccountId } from '../../metadata/types';
import type GitProjectModel from '../GitProjectModel';
import { repoDriverAccountMetadataParser } from '../../metadata/schemas';
import retryFindGitProject from '../../utils/retryFindGitProject';
import getIpfsFile from '../../utils/getIpfsFile';
import validateGitProjectMetadata from './validateProjectMetadata';
import { ProjectVerificationStatus } from '../GitProjectModel';

export default async function updateGitProjectMetadata(
  requestId: UUID,
  accountId: AccountId,
  ipfsHashBytes: string,
  transaction: Transaction,
): Promise<
  [GitProjectModel, AnyVersion<typeof repoDriverAccountMetadataParser>]
> {
  const gitProject: GitProjectModel = await retryFindGitProject(
    requestId,
    accountId,
    transaction,
  );

  const ipfsHash = ethers.toUtf8String(ipfsHashBytes);
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

  return [gitProject, metadata];
}
