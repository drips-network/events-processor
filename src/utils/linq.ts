export function singleOrDefault<T>(array: T[]): T | null {
  if (array.length === 1) {
    return array[0];
  }

  if (array.length === 0) {
    return null;
  }

  throw new Error('The array contains more than one element.');
}
