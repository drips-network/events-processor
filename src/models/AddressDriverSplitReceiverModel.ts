import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import getSchema from '../utils/getSchema';
import GitProjectModel from './GitProjectModel';
import type { AddressDriverId, NftDriverId, RepoDriverId } from '../core/types';
import DripListModel from './DripListModel';
import EcosystemModel from './EcosystemModel';

export enum AddressDriverSplitReceiverType {
  ProjectMaintainer = 'ProjectMaintainer',
  ProjectDependency = 'ProjectDependency',
  DripListDependency = 'DripListDependency',
  EcosystemDependency = 'EcosystemDependency',
}

export default class AddressDriverSplitReceiverModel extends Model<
  InferAttributes<AddressDriverSplitReceiverModel>,
  InferCreationAttributes<AddressDriverSplitReceiverModel>
> {
  public declare id: CreationOptional<number>; // Primary key
  public declare funderProjectId: RepoDriverId | null; // Foreign key
  public declare funderDripListId: NftDriverId | null; // Foreign key
  public declare funderEcosystemId: NftDriverId | null; // Foreign key

  public declare weight: number;
  public declare type: AddressDriverSplitReceiverType;
  public declare fundeeAccountId: AddressDriverId;
  public declare fundeeAccountAddress: AddressLike;
  public declare blockTimestamp: Date;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        fundeeAccountId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        fundeeAccountAddress: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        funderProjectId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: GitProjectModel,
            key: 'id',
          },
          allowNull: true,
        },
        funderDripListId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: DripListModel,
            key: 'id',
          },
          allowNull: true,
        },
        funderEcosystemId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: EcosystemModel,
            key: 'id',
          },
          allowNull: true,
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        type: {
          type: DataTypes.ENUM(
            ...Object.values(AddressDriverSplitReceiverType),
          ),
          allowNull: false,
        },
        blockTimestamp: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      {
        sequelize,
        schema: getSchema(),
        tableName: 'AddressDriverSplitReceivers',
        indexes: [
          {
            fields: ['fundeeAccountId'],
            name: `IX_AddressDriverSplitReceivers_fundeeAccountId`,
            unique: false,
          },
          {
            fields: ['funderDripListId'],
            name: `IX_AddressDriverSplitReceivers_funderDripListId`,
            where: {
              type: AddressDriverSplitReceiverType.DripListDependency,
            },
            unique: false,
          },
          {
            fields: ['funderEcosystemId'],
            name: `IX_AddressDriverSplitReceivers_funderEcosystemId`,
            where: {
              type: AddressDriverSplitReceiverType.EcosystemDependency,
            },
            unique: false,
          },
        ],
      },
    );
  }
}
