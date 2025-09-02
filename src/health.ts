import type { RequestHandler } from 'express';
import logger from './core/logger';
import getProvider from './core/getProvider';
import LastIndexedBlockModel from './models/LastIndexedBlockModel';

export const healthEndpoint: RequestHandler = async (req, res) => {
  const HEALTH_THRESHOLD = 10;

  try {
    const provider = getProvider();
    const latestChainBlock = await provider.getBlockNumber();

    const lastIndexedBlockRecord = await LastIndexedBlockModel.findOne({
      order: [['blockNumber', 'DESC']],
    });

    const lastIndexedBlock = lastIndexedBlockRecord
      ? Number(lastIndexedBlockRecord.blockNumber)
      : 0;

    const blockDifference = latestChainBlock - lastIndexedBlock;

    if (blockDifference < HEALTH_THRESHOLD) {
      return res.status(200).send({
        status: 'OK',
        latestChainBlock,
        lastIndexedBlock,
        blockDifference,
      });
    }

    logger.warn(
      `Health check failed: Service is ${blockDifference} blocks behind (Threshold: ${HEALTH_THRESHOLD}).`,
    );
    return res.status(503).send({
      status: 'Unhealthy',
      latestChainBlock,
      lastIndexedBlock,
      blockDifference,
      message: `Indexer is ${blockDifference} blocks behind the chain.`,
    });
  } catch (error: any) {
    logger.error(`Health check endpoint error: ${error.message}`, error);
    return res.status(500).send({
      status: 'Error',
      message: 'Internal server error during health check.',
    });
  }
};
