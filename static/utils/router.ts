export class Router<
  H extends { StringHandlerArg: unknown; PatternHandlerArg: unknown },
  R,
> {
  #stringKey: Record<string, (arg: H["StringHandlerArg"]) => R>;
  #URLPatternKey: [URLPattern, (arg: H["PatternHandlerArg"]) => R][];
  constructor() {
    this.#stringKey = {};
    this.#URLPatternKey = [];
  }
  set(key: string, handler: (arg: H["StringHandlerArg"]) => R): void;
  set(
    key: URLPattern,
    handler: (arg: H["PatternHandlerArg"]) => R,
  ): void;
  set(
    key: URLPattern | string,
    handler:
      | ((arg: H["StringHandlerArg"]) => R)
      | ((arg: H["PatternHandlerArg"]) => R),
  ) {
    if (key instanceof URLPattern) {
      this.#URLPatternKey.push([key, handler]);
    } else {
      if (key in this.#stringKey) {
        throw new Error(`cannot set duplicate handler: ${key}`);
      }
      this.#stringKey[key] = handler;
    }
  }
  get(requestUrl: URLPatternInit & { pathname: string }) {
    const { pathname } = requestUrl;
    if (this.#stringKey[pathname]) {
      return { handler: this.#stringKey[pathname] };
    }
    for (const [pattern, handler] of this.#URLPatternKey) {
      const match = pattern.exec(requestUrl);
      if (match) {
        return { handler, match };
      }
    }
    return {};
  }
}
