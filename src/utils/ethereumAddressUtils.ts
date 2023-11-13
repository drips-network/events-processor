import { isAddress } from 'ethers';
import type { Address } from '../core/types';

export function toAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}.`);
  }

  return address as Address;
}
