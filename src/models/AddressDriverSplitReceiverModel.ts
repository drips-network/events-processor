import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
} from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { AddressLike } from 'ethers';
import getSchema from '../utils/getSchema';
import ProjectModel from './ProjectModel';
import type {
  AddressDriverId,
  ImmutableSplitsDriverId,
  NftDriverId,
  RepoDriverId,
} from '../core/types';
import DripListModel from './DripListModel';
import EcosystemMainAccountModel from './EcosystemMainAccountModel';
import SubListModel from './SubListModel';

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
  public declare fundeeAccountId: AddressDriverId;
  public declare fundeeAccountAddress: AddressLike;
  public declare funderProjectId: RepoDriverId | null; // Foreign key
  public declare funderDripListId: NftDriverId | null; // Foreign key
  public declare funderEcosystemMainAccountId: NftDriverId | null; // Foreign key
  public declare funderSubListId: ImmutableSplitsDriverId | null; // Foreign key

  public declare weight: number;
  public declare type: AddressDriverSplitReceiverType;
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
            model: ProjectModel,
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
        funderEcosystemMainAccountId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: EcosystemMainAccountModel,
            key: 'id',
          },
          allowNull: true,
        },
        funderSubListId: {
          // Foreign key
          type: DataTypes.STRING,
          references: {
            model: SubListModel,
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
            fields: ['funderEcosystemMainAccountId'],
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
