import type { InferAttributes, InstanceUpdateOptions } from 'sequelize';
import GitProjectModel from './GitProjectModel';
import assertTransaction from '../../utils/assert';
import { logRequestInfo, nameOfType } from '../../utils/logRequest';

GitProjectModel.addHook(
  'afterCreate',
  (
    instance: GitProjectModel,
    options: InstanceUpdateOptions<
      InferAttributes<
        GitProjectModel,
        {
          omit: never;
        }
      >
    >,
  ): void => {
    const { transaction, requestId } = options as any;
    assertTransaction(transaction);

    logRequestInfo(
      `Created a new ${nameOfType(GitProjectModel)} DB entry for ${
        instance.name
      } repo, with ID ${instance.accountId}.`,
      requestId,
    );
  },
);

GitProjectModel.addHook(
  'afterUpdate',
  (
    instance: GitProjectModel,
    options: InstanceUpdateOptions<
      InferAttributes<
        GitProjectModel,
        {
          omit: never;
        }
      >
    >,
  ): void => {
    const { transaction, requestId } = options as any;
    assertTransaction(transaction);

    logRequestInfo(
      `Updated Git project with ID ${
        instance.accountId
      }. Updated fields were: ${(instance.changed() as string[]).map(
        (property) => property,
      )}.`,
      requestId,
    );
  },
);
