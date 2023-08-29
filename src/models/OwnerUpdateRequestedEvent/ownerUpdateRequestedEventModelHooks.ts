import type { InferAttributes, InstanceUpdateOptions } from 'sequelize';
import { ethers } from 'ethers';
import OwnerUpdateRequestedEventModel from './OwnerUpdateRequestedEventModel';
import assertTransaction from '../../utils/assert';
import { logRequestInfo, nameOfType } from '../../utils/logRequest';
import GitProjectModel, {
  ProjectVerificationStatus,
} from '../GitProjectModel/GitProjectModel';

OwnerUpdateRequestedEventModel.addHook(
  'afterCreate',
  async (
    instance: OwnerUpdateRequestedEventModel,
    options: InstanceUpdateOptions<
      InferAttributes<
        OwnerUpdateRequestedEventModel,
        {
          omit: never;
        }
      >
    >,
  ): Promise<void> => {
    const { transaction, requestId } = options as any;
    assertTransaction(transaction);

    const {
      name,
      forge,
      logIndex,
      transactionHash,
      accountId: gitProjectAccountId,
    } = instance;

    logRequestInfo(
      `Created a new ${nameOfType(
        OwnerUpdateRequestedEventModel,
      )} DB entry with ID ${transactionHash}-${logIndex}`,
      requestId,
    );

    await GitProjectModel.create(
      {
        forge: Number(forge),
        accountId: gitProjectAccountId,
        name: ethers.toUtf8String(name),
        verificationStatus: ProjectVerificationStatus.OwnerUpdateRequested,
      },
      { transaction, requestId },
    );
  },
);
