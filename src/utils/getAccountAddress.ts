/* eslint-disable no-bitwise */
import { ethers } from 'ethers';
import { isAddressDriverId } from './accountIdUtils';

export default function getUserAddress(accountId: string): string {
  if (!accountId) {
    throw new Error(`Could not get user address: accountId is missing.`);
  }

  const accountIdAsBn = BigInt(accountId);

  if (accountIdAsBn < 0 || accountIdAsBn > ethers.MaxUint256) {
    throw new Error(
      `Could not get user address: ${accountId} is not a valid positive number within the range of a uint256.`,
    );
  }

  if (isAddressDriverId(accountId)) {
    const mid64BitsMask = (BigInt(2) ** BigInt(64) - BigInt(1)) << BigInt(160);

    if ((accountIdAsBn & mid64BitsMask) !== BigInt(0)) {
      throw new Error(
        `Could not get user address: ${accountId} is not a valid user ID. The first 64 (after first 32) bits must be 0.`,
      );
    }
  }

  const mask = BigInt(2) ** BigInt(160) - BigInt(1);
  const address = accountIdAsBn & mask;

  // Convert BigInt to a hex string and pad with zeros
  const paddedAddress = address.toString(16).padStart(40, '0').toLowerCase();

  // You would still use ethers.js to checksum the address
  return ethers.getAddress(`0x${paddedAddress}`);
}
