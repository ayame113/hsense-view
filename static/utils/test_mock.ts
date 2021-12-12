type unknownReturnType<T, K extends keyof T> // deno-lint-ignore no-explicit-any
 = T[K] extends (...args: any) => any ? ReturnType<T[K]> : never;

type unknownParameters<T, K extends keyof T> // deno-lint-ignore no-explicit-any
 = T[K] extends (...args: any) => any ? Parameters<T[K]>[] : never[];

export function mockFn<T, K extends keyof T>(
  target: T,
  key: K,
  fn: ((...args: unknownParameters<T, K>) => unknownReturnType<T, K>),
) {
  const originalFunction = target[key];
  const res = {
    calls: [] as unknownParameters<T, K>[],
    release() {
      target[key] = originalFunction;
    },
  };
  // @ts-ignore: for test
  target[key] = (...args: unknownParameters<T, K>) => {
    res.calls.push(args);
    return fn(...args);
  };
  return res;
}
