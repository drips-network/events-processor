import type { InitOptions } from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import type { Address, IModelDefinition } from '../common/types';
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

export interface GitHubSource {
  forge: 'github';
  url: string;
  repoName: string;
  ownerName: string;
}

export interface IGitProjectAttributes {
  id: string; // Primary key.
  forge: Forge;
  repoName: string;
  repoNameBytes: string;
  blockTimestamp: Date | null;
  ownerAddress: Address | null;
  verificationStatus: ProjectVerificationStatus;
}

class GitProjectModel extends Model implements IGitProjectAttributes {
  public id!: string; // Primary key (accountId).
  public forge!: Forge;
  public repoName!: string;
  public repoNameBytes!: string;
  public blockTimestamp!: Date | null;
  public ownerAddress!: Address | null;
  public verificationStatus!: ProjectVerificationStatus;
}

export class GitProjectModelDefinition
  implements IModelDefinition<GitProjectModel, IGitProjectAttributes>
{
  public static model = GitProjectModel;

  public attributes = {
    // The `accountId`.
    id: {
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
  };

  public initOptions: InitOptions<Model<any, any>> = createInitOptions({
    modelName: 'GitProjectModel',
    tableName: 'GitProjects',
  });
}
