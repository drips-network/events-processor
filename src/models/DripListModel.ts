import type {
  InferAttributes,
  InferCreationAttributes,
  InstanceUpdateOptions,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import type { DripListId, KnownAny } from '../common/types';
import getSchema from '../utils/getSchema';
import { assertRequestId, assertTransaction } from '../utils/assert';
import { logRequestDebug, nameOfType } from '../utils/logRequest';
import getChangedProperties from '../utils/getChangedProperties';

export default class DripListModel extends Model<
  InferAttributes<DripListModel>,
  InferCreationAttributes<DripListModel>
> {
  public declare tokenId: DripListId; // The `tokenId` from `TransferEvent` event.

  // Properties from metadata.
  public declare isPublic: false;
  public declare name: string | null;
  public declare ownerAddress: AddressLike;
  // TODO: add description after metadata v3 is updated.

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        tokenId: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        ownerAddress: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        isPublic: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'DripLists',
        hooks: {
          afterCreate,
          afterUpdate,
        },
      },
    );
  }
}

async function afterCreate(
  instance: DripListModel,
  options: InstanceUpdateOptions<
    InferAttributes<
      DripListModel,
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
    `Created a new ${nameOfType(DripListModel)} DB entry with (token) ID ${
      instance.tokenId
    } (name: ${instance.name})`,
    requestId,
  );
}

async function afterUpdate(
  instance: DripListModel,
  options: InstanceUpdateOptions<
    InferAttributes<
      DripListModel,
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
    `Updated Drip List with (token) ID ${instance.tokenId}: ${JSON.stringify(
      getChangedProperties(instance),
    )}.`,
    requestId,
  );
}
