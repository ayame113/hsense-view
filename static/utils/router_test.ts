import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.117.0/testing/asserts.ts";
import { Router } from "./router.ts";

type PromiseOrValue<T> = T | Promise<T>;

type RequestRouter = Router<
  {
    StringHandlerArg: {
      request: Readonly<Request>;
      url: Readonly<URL>;
    };
    PatternHandlerArg: {
      request: Readonly<Request>;
      url: Readonly<URL>;
      match: URLPatternResult;
    };
  },
  PromiseOrValue<
    {
      body: BodyInit;
      status?: number;
      extension?: string;
    } | {
      body?: BodyInit;
      status: number;
      extension?: string;
    }
  >
>;

Deno.test("handle string routing", () => {
  const router = new Router();
  const routerResult = {};
  router.set("/hello", () => routerResult);
  const { handler } = router.get(new URL("https:foo.com/hello"));
  assert(routerResult === handler?.({}));
});

Deno.test("handle pattern routing", () => {
  const router = new Router();
  const routerResult = {};
  router.set(new URLPattern({ pathname: "/:foo/bar" }), () => routerResult);
  const { handler, match } = router.get(new URL("https:foo.com/hello/bar"));
  assert(routerResult === handler?.({}));
  assertEquals(match?.pathname, {
    groups: { foo: "hello" },
    input: "/hello/bar",
  });
});

Deno.test("handle string and pattern routing", () => {
  const router: RequestRouter = new Router();
  const routerResult = { status: 200 };
  router.set("/hello", () => routerResult);
  router.set(new URLPattern({ pathname: "/:foo/bar" }), () => routerResult);
  {
    const routed = router.get(new URL("https:foo.com/hello"));
    assert(
      routerResult === routed.handler?.({
        request: new Request("https:foo.com/hello/bar"),
        url: new URL("https:foo.com/hello/bar"),
        match: routed.match!,
      }),
    );
  }
  {
    const routed = router.get(new URL("https:foo.com/hello/bar"));
    assert(
      routerResult === routed.handler?.({
        request: new Request("https:foo.com/hello/bar"),
        url: new URL("https:foo.com/hello/bar"),
        match: routed.match!,
      }),
    );
    assertEquals(routed.match?.pathname, {
      groups: { foo: "hello" },
      input: "/hello/bar",
    });
  }
});

Deno.test("duplicate handler should throw", () => {
  const router = new Router();
  const routerResult = {};
  router.set("/hello", () => routerResult);
  assertThrows(() => {
    router.set("/hello", () => routerResult);
  });
});
