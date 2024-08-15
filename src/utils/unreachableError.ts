export default function unreachableError(message?: string): never {
  throw new Error(`This should never happen. ${message ?? ''}`);
}
