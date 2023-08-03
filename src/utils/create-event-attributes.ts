import { DataTypes } from 'sequelize';
import type { KeysOf, KeysToModelAttributes } from '../common/types';

const eventModelBaseAttributes = {
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
    type: DataTypes.JSON, // TODO: consider JSONB if needed
    allowNull: true,
  },
};

export default function createEventAttributes<TAttributes>(
  options: KeysToModelAttributes<KeysOf<TAttributes>>,
) {
  return {
    ...eventModelBaseAttributes,
    ...options,
  };
}
