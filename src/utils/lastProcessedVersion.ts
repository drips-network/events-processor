/* eslint-disable no-bitwise */

/**
 * Packs a blockNumber and logIndex into a single BigInt “version.”
 */
export function makeVersion(blockNumber: number, logIndex: number): bigint {
  // shift `blockNumber` into the high‐32 bits, OR in the low‐32‐bit `logIndex`.
  return (BigInt(blockNumber) << 32n) | BigInt(logIndex);
}

/**
 * Unpacks a BigInt “version” back into its `blockNumber` and `logIndex` parts.
 */
export function decodeVersion(version: bigint): {
  blockNumber: number;
  logIndex: number;
} {
  // High 32 bits contain the blockNumber.
  const blockNumber = Number(version >> 32n);
  // Low 32 bits contain the logIndex.
  const logIndex = Number(version & ((1n << 32n) - 1n));
  return { blockNumber, logIndex };
}
