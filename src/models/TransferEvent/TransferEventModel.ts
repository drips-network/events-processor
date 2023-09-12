import type { AddressLike } from 'ethers';
import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
  Sequelize,
  Transaction,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type {
  IEventModel,
  KnownAny,
  NftDriverAccountId,
} from '../../common/types';
import getSchema from '../../utils/getSchema';
import { assertRequestId, assertTransaction } from '../../utils/assert';
import { logRequestDebug, nameOfType } from '../../utils/logRequest';
import DripListModel from '../DripListModel';
import IsDripList from './isDripList';
import { COMMON_EVENT_INIT_ATTRIBUTES } from '../../common/constants';

export default class TransferEventModel
  extends Model<
    InferAttributes<TransferEventModel>,
    InferCreationAttributes<TransferEventModel>
  >
  implements IEventModel
{
  public declare tokenId: NftDriverAccountId; // The `tokenId` from `Transfer` event.
  public declare from: AddressLike;
  public declare to: AddressLike;

  // Common event log properties.
  public declare logIndex: number;
  public declare blockNumber: number;
  public declare blockTimestamp: Date;
  public declare transactionHash: string;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        tokenId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        from: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        to: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ...COMMON_EVENT_INIT_ATTRIBUTES,
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'TransferEvents',
        hooks: {
          afterCreate,
        },
      },
    );
  }
}

async function afterCreate(
  instance: TransferEventModel,
  options: InstanceUpdateOptions<
    InferAttributes<
      TransferEventModel,
      {
        omit: never;
      }
    >
  >,
): Promise<void> {
  const { transaction, requestId } = options as KnownAny; // `as any` to avoid TS complaining about passing in the `requestId`.
  assertTransaction(transaction);
  assertRequestId(requestId);

  logRequestDebug(
    `Created a new ${nameOfType(TransferEventModel)} DB entry with (token) ID ${
      instance.tokenId
    }`,
    requestId,
  );

  const { to, tokenId } = instance;

  const totalOwnerNftAccounts = await TransferEventModel.count({
    where: {
      to,
    },
    transaction,
  });

  if (await IsDripList(tokenId, totalOwnerNftAccounts, to)) {
    const [dripList] = await DripListModel.findOrCreate({
      transaction,
      lock: true,
      requestId,
      where: {
        tokenId,
      },
      defaults: {
        tokenId,
        name: null,
        isPublic: false,
        ownerAddress: to,
      },
    } as KnownAny); // `as any` to avoid TS complaining about passing in the `requestId`.

    if (await isLatestEvent(instance, transaction)) {
      dripList.ownerAddress = to;

      await dripList.save({ transaction });
    }
  }
}

async function isLatestEvent(
  instance: TransferEventModel,
  transaction: Transaction,
): Promise<boolean> {
  const latestEvent = await TransferEventModel.findOne({
    where: {
      tokenId: instance.tokenId,
    },
    order: [
      ['blockNumber', 'DESC'],
      ['logIndex', 'DESC'],
    ],
    transaction,
    lock: true,
  });

  if (!latestEvent) {
    return true;
  }

  if (
    latestEvent.blockNumber > instance.blockNumber ||
    (latestEvent.blockNumber === instance.blockNumber &&
      latestEvent.logIndex > instance.logIndex)
  ) {
    return false;
  }

  return true;
}
