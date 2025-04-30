import assert from 'assert';

import type { BaseContract, Provider } from 'ethers';
import { isRegisteredEvent, type getHandlers } from './eventHandlerUtils';
import type { Address, KnownAny } from '../core/types';
import EventHandlerRequest from './EventHandlerRequest';
import type EventHandlerBase from './EventHandlerBase';
import type { EventSignature } from './types';
import _LastIndexedBlockModel from '../models/_LastIndexedBlockModel';
import logger from '../core/logger';
import appSettings from '../config/appSettings';

async function getLatestIndexedBlock() {
  const record = await _LastIndexedBlockModel.findOne({
    order: [['block_number', 'DESC']],
  });

  return record?.blockNumber ? Number(record.blockNumber) : 0;
}

function setLatestIndexedBlock(blockNumber: number) {
  return _LastIndexedBlockModel.upsert({
    id: 1,
    blockNumber: BigInt(blockNumber),
  });
}

const { pollingInterval, chunkSize, confirmations } = appSettings;

export default async function poll(
  contracts: {
    contract: BaseContract;
    address: Address;
  }[],
  registrations: ReturnType<typeof getHandlers>,
  provider: Provider,
  startFromBlock?: number,
) {
  const latestBlock = await provider.getBlockNumber();
  const lastIndexedBlock = await getLatestIndexedBlock();

  let fromBlock = Math.max(startFromBlock ?? 0, lastIndexedBlock + 1);
  const toBlock = Math.min(
    fromBlock + chunkSize - 1,
    latestBlock - confirmations,
  );

  fromBlock = Math.min(fromBlock, toBlock);

  logger.info(`Polling for events from block ${fromBlock} to ${toBlock}`);

  if (toBlock !== lastIndexedBlock) {
    const logs = await provider.getLogs({
      address: contracts.map((c) => c.address),
      fromBlock,
      toBlock,
    });

    const parsedLogs = logs
      .map((l) => {
        const { address } = l;

        const contractW = contracts.find((c) => c.address === address);
        assert(contractW, `Contract not found for address: ${address}`);

        const parsedLog = contractW.contract.interface.parseLog(l);
        if (!parsedLog) {
          logger.warn(`Unable to parse log: ${JSON.stringify(l)}`);
          return undefined;
        }

        return { log: l, parsedLog };
      })
      .filter((pl) => !!pl);

    await Promise.all(
      parsedLogs.map(async ({ log, parsedLog }) => {
        const { signature } = parsedLog;

        if (isRegisteredEvent(signature)) {
          const handler: EventHandlerBase<EventSignature> | undefined =
            registrations[signature];
          assert(
            handler,
            `No handler found for event with signature: ${signature}`,
          );

          await handler?.createJob(
            new EventHandlerRequest<typeof signature>(
              {
                logIndex: log.index,
                blockNumber: log.blockNumber,
                blockTimestamp: new Date(
                  (await log.getBlock()).timestamp * 1000,
                ),
                transactionHash: log.transactionHash,
                args: parsedLog.args as KnownAny,
                eventSignature: signature,
              },
              `${log.blockNumber}-${log.transactionHash}-${log.index}`,
            ),
          );
        }
      }),
    );

    await setLatestIndexedBlock(toBlock);
  }

  const delay = toBlock === fromBlock ? pollingInterval : 0;

  setTimeout(() => {
    poll(contracts, registrations, provider);
  }, delay);
}
