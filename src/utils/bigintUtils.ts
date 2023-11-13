import type { BigIntString } from '../core/types';

export function toBigIntString(string: string): BigIntString {
  const bigInt = BigInt(string);

  return bigInt.toString() as BigIntString;
}
