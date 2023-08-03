import { Model } from 'sequelize';

export interface IEventModelBaseAttributes {
  rawEvent: string;
  logIndex: number;
  blockNumber: number;
  transactionHash: string;
  blockTimestamp: Date | null;
}

export abstract class EventModelBase
  extends Model
  implements IEventModelBaseAttributes
{
  public rawEvent!: string;
  public logIndex!: number;
  public blockNumber!: number;
  public blockTimestamp!: Date;
  public transactionHash!: string;
}
