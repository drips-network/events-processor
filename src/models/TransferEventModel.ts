import type { AddressLike } from 'ethers';
import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type {
  IEventModel,
  KnownAny,
  NftDriverAccountId,
} from '../common/types';
import getSchema from '../utils/getSchema';
import { assertRequestId, assertTransaction } from '../utils/assert';
import { logRequestDebug, nameOfType } from '../utils/logRequest';

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
          primaryKey: true,
        },
        from: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        to: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        transactionHash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        logIndex: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        blockTimestamp: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        blockNumber: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
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
}
