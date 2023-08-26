export default function shouldNeverHappen(): never {
  throw new Error('This should never happen.');
}
