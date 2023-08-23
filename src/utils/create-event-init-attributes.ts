import { DataTypes } from 'sequelize';
import type { KeysOf, KeysToModelAttributes } from '../common/types';

const eventInitAttributes = {
  // Primary key
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  transactionHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  logIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  blockNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  blockTimestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  rawEvent: {
    type: DataTypes.JSON,
    allowNull: false,
  },
};

export default function createEventInitAttributes<TAttributes>(
  options: KeysToModelAttributes<KeysOf<TAttributes>>,
) {
  return {
    ...eventInitAttributes,
    ...options,
  };
}
