import { DataTypes } from 'sequelize';
import type { KeysOf, KeysToModelAttributes } from '../common/types';

const eventInitAttributes = {
  transactionHash: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  logIndex: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  blockNumber: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  blockTimestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  rawEvent: {
    type: DataTypes.JSON,
    allowNull: true,
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
