import { DataTypes, Model } from 'sequelize';
import type { Address } from '../common/types';
import createInitOptions from '../utils/create-init-options';

export enum Forge {
  GitHub = 0,
}

export enum ProjectVerificationStatus {
  NotStarted = 'NotStarted',
  ClaimingProject = 'ClaimingProject',
  ProjectClaimed = 'ProjectClaimed',
  AwaitingProjectMetadata = 'AwaitingProjectMetadata',
  Completed = 'Completed',
  Failed = 'Failed',
}

export class GitProjectModel extends Model {
  public accountId!: string; // Primary key
  public forge!: Forge;
  public repoName!: string;
  public repoNameBytes!: string;
  public blockTimestamp!: Date | null;
  public ownerAddress!: Address | null;
  public verificationStatus!: ProjectVerificationStatus;

  public static initialize(): void {
    this.init(
      {
        accountId: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        repoName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        repoNameBytes: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        forge: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            // Forge
            min: 0,
            max: 0,
          },
        },
        verificationStatus: {
          type: DataTypes.ENUM(...Object.values(ProjectVerificationStatus)),
          allowNull: false,
        },
        ownerAddress: {
          type: DataTypes.STRING, // Address
          allowNull: true,
        },
        blockTimestamp: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      createInitOptions({
        modelName: 'GitProject',
        tableName: 'GitProjects',
      }),
    );
  }
}
