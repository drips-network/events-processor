import type { Result } from '../core/types';

async function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds)); // eslint-disable-line no-promise-executor-return
}

type RetryError = {
  message: string;
  errors: string[];
  attempts: number;
};

export function isRetryError(err: unknown): err is RetryError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    'errors' in err &&
    'attempts' in err
  );
}

export default async function retryOperation<T>(
  operation: () => T | Promise<T>,
  maxRetries: number = 3,
): Promise<Result<T>> {
  let attempts = 0;
  const baseDelay = 100;
  const errors: string[] = [];

  while (attempts < maxRetries) {
    attempts += 1;

    try {
      const result = await Promise.resolve(operation());
      return {
        ok: true,
        value: result,
      };
    } catch (error: any) {
      errors.push(error.message);

      if (attempts < maxRetries) {
        const delay = baseDelay * 2 ** attempts;
        await sleep(delay);
      }
    }
  }

  return {
    ok: false,
    error: {
      message: errors[errors.length - 1],
      errors,
      attempts,
    },
  };
}
