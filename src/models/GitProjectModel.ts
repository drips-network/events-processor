import { DataTypes, Model } from 'sequelize';
import type { Address } from '../common/types';
import createInitOptions from '../utils/create-init-options';

export enum Forge {
  GitHub = 0,
}

export enum ProjectVerificationStatus {
  OwnerVerificationRequested = 'OwnerVerificationRequested',
  OwnerVerified = 'OwnerVerified',
  Completed = 'Completed',
}

export class GitProjectModel extends Model {
  public id!: number; // Primary key

  public accountId!: string;
  public verificationStatus!: ProjectVerificationStatus;

  // Properties from `OwnerUpdateRequested` event.
  public forge!: Forge;
  public repoName!: string;

  // Properties from `OwnerUpdated` event.
  public ownerAddress!: Address | null;

  // Properties from metadata.
  public url!: string;
  public emoji!: string;
  public color!: string;
  public ownerName!: string;
  public description!: string;

  public static initialize(): void {
    this.init(
      {
        accountId: {
          type: DataTypes.STRING, // the `RepoDriver` account ID.
          primaryKey: true,
        },
        verificationStatus: {
          type: DataTypes.ENUM(...Object.values(ProjectVerificationStatus)),
          allowNull: false,
        },

        // Properties from `OwnerUpdateRequested` event.
        forge: {
          type: DataTypes.ENUM(
            ...Object.values(Forge).map((v) => v.toString()),
          ),
          allowNull: false,
        },
        repoName: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        // Properties from `OwnerUpdated` event.
        ownerAddress: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        // Properties from metadata.
        url: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        emoji: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        color: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        description: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        ownerName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      createInitOptions({
        modelName: 'GitProject',
        tableName: 'GitProjects',
      }),
    );
  }
}
