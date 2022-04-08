// deno-lint-ignore-file no-explicit-any
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.134.0/testing/asserts.ts";

import { router } from "../router.ts";
import "./db.ts";

const encoder = new TextEncoder();

Deno.test(
  "/sse/data/:id - success",
  async () => {
    const channel = new BroadcastChannel(`data.apple`);
    const { handler, match } = router.GET.get({
      pathname: "/sse/data/apple",
    });
    const result = await handler!({ match } as any);

    assertEquals(result.contentType, "text/event-stream; charset=utf-8");
    assert(result.body instanceof ReadableStream);
    const reader = result.body.getReader();

    channel.postMessage("some data");
    assertEquals(await reader.read(), {
      value: encoder.encode("data: some data\n\n"),
      done: false,
    });
    channel.postMessage("foo \nbar");
    assertEquals(await reader.read(), {
      value: encoder.encode("data: foo \ndata: bar\n\n"),
      done: false,
    });

    await reader.cancel();
    assertEquals(await reader.read(), {
      value: undefined,
      done: true,
    });
    channel.close();
  },
);
