import type { BigIntString } from '../core/types';

export function toBigIntString(value: string | bigint): BigIntString {
  const bigInt = BigInt(value);

  return bigInt.toString() as BigIntString;
}
