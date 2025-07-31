import type { SplitsSetEvent } from '../../../contracts/CURRENT_NETWORK/Drips';
import ScopedLogger from '../../core/ScopedLogger';
import { dbConnection } from '../../db/database';
import EventHandlerBase from '../../events/EventHandlerBase';
import type EventHandlerRequest from '../../events/EventHandlerRequest';
import SplitsSetEventModel from '../../models/SplitsSetEventModel';
import { convertToAccountId, isOrcidAccount } from '../../utils/accountIdUtils';
import setIsValidFlag from './setIsValidFlag';
import { setLinkedIdentityFlag } from './setLinkedIdentityFlag';

export default class SplitsSetEventHandler extends EventHandlerBase<'SplitsSet(uint256,bytes32)'> {
  public eventSignatures = ['SplitsSet(uint256,bytes32)' as const];

  protected async _handle({
    id: requestId,
    event: {
      args,
      logIndex,
      blockNumber,
      blockTimestamp,
      transactionHash,
      eventSignature,
    },
  }: EventHandlerRequest<'SplitsSet(uint256,bytes32)'>): Promise<void> {
    const [rawAccountId, rawReceiversHash] = args as SplitsSetEvent.OutputTuple;
    const accountId = convertToAccountId(rawAccountId);

    const scopedLogger = new ScopedLogger(this.name, requestId);

    scopedLogger.log(
      [
        `📥 ${this.name} is processing ${eventSignature}:`,
        `  - accountId:     ${accountId}`,
        `  - receiversHash: ${rawReceiversHash}`,
        `  - logIndex:      ${logIndex}`,
        `  - txHash:        ${transactionHash}`,
      ].join('\n'),
    );

    await dbConnection.transaction(async (transaction) => {
      const splitsSetEvent = await SplitsSetEventModel.create(
        {
          accountId,
          receiversHash: rawReceiversHash,
          logIndex,
          blockNumber,
          blockTimestamp,
          transactionHash,
        },
        { transaction },
      );

      scopedLogger.bufferCreation({
        type: SplitsSetEventModel,
        input: splitsSetEvent,
        id: `${splitsSetEvent.transactionHash}-${splitsSetEvent.logIndex}`,
      });

      // Account's splits are set by `AccountMetadataEmitted` events.
      // The `SplitsSet` event only confirms that the split receivers are valid.

      await setIsValidFlag(splitsSetEvent, scopedLogger, transaction);

      if (isOrcidAccount(accountId)) {
        await setLinkedIdentityFlag(accountId, scopedLogger, transaction);
      }

      scopedLogger.flush();
    });
  }
}
