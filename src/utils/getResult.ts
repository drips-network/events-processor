import type { Result } from '../common/types';

export default function getResult<TArgs extends any[], TReturn>(
  func: (...args: TArgs) => TReturn | Promise<TReturn>,
): (...args: TArgs) => Promise<Result<TReturn>> {
  return async (...args: TArgs): Promise<Result<TReturn>> => {
    try {
      const result = await Promise.resolve(func(...args));
      return {
        value: result,
        ok: true,
      };
    } catch (e: any) {
      return {
        error: e,
        ok: false,
      };
    }
  };
}
