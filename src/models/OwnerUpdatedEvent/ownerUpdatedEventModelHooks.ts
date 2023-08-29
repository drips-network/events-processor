import type { InferAttributes, InstanceUpdateOptions } from 'sequelize';
import OwnerUpdatedEventModel from './OwnerUpdatedEventModel';
import assertTransaction from '../../utils/assert';
import { logRequestInfo, nameOfType } from '../../utils/logRequest';
import retryFindGitProject from '../../utils/retryFindGitProject';
import { ProjectVerificationStatus } from '../GitProjectModel/GitProjectModel';

OwnerUpdatedEventModel.addHook(
  'afterCreate',
  async (
    instance: OwnerUpdatedEventModel,
    options: InstanceUpdateOptions<
      InferAttributes<
        OwnerUpdatedEventModel,
        {
          omit: never;
        }
      >
    >,
  ): Promise<void> => {
    const { transaction, requestId } = options as any;
    assertTransaction(transaction);

    const {
      owner,
      logIndex,
      transactionHash,
      accountId: gitProjectAccountId,
    } = instance;

    logRequestInfo(
      `Created a new ${nameOfType(
        OwnerUpdatedEventModel,
      )} DB entry with ID ${transactionHash}-${logIndex}`,
      requestId,
    );

    const gitProject = await retryFindGitProject(
      requestId,
      gitProjectAccountId,
      transaction,
    );

    await gitProject.update(
      {
        owner,
        verificationStatus: ProjectVerificationStatus.OwnerUpdated,
      },
      { transaction, requestId } as any,
    );
  },
);
