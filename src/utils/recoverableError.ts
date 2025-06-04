export default class RecoverableError extends Error {
  constructor(message: string) {
    super(message);
  }
}
