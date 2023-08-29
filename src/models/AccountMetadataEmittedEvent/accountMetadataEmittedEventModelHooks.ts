import type { UUID } from 'crypto';
import type { CreateOptions, InferAttributes } from 'sequelize';
import assertTransaction from '../../utils/assert';
import isAccountGitProject from '../../utils/isAccountGitProject';
import { logRequestInfo, nameOfType } from '../../utils/logRequest';
import AccountMetadataEmittedEventModel from './AccountMetadataEmittedEventModel';
import updateGitProjectMetadata from './updateGitProjectMetadata';

AccountMetadataEmittedEventModel.addHook(
  'afterCreate',
  (
    newInstance: AccountMetadataEmittedEventModel,
    options: CreateOptions<
      InferAttributes<
        AccountMetadataEmittedEventModel,
        {
          omit: never;
        }
      >
    > & { requestId: UUID },
  ): Promise<void> => {
    const { transactionHash, logIndex } = newInstance;
    const { transaction, requestId } = options as any;

    assertTransaction(transaction);

    logRequestInfo(
      `Created a new ${nameOfType(
        AccountMetadataEmittedEventModel,
      )} DB entry with ID ${transactionHash}-${logIndex}`,
      requestId,
    );

    if (isAccountGitProject(newInstance.accountId)) {
      return updateGitProjectMetadata(newInstance, options as any);
    }

    return Promise.resolve();
  },
);
