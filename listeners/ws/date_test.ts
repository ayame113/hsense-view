// deno-lint-ignore-file no-explicit-any
import { assert } from "https://deno.land/std@0.122.0/testing/asserts.ts";
import { deferred } from "https://deno.land/std@0.122.0/async/mod.ts";

import { MockWebSocket } from "../../static/utils/test_mock.ts";
import { socketRouter } from "../router.ts";
import "./date.ts";

Deno.test("/ws/date - close", async () => {
  const end = deferred();
  let counter = 0;
  const socket = new MockWebSocket((data: any) => {
    counter++;
    assert(Math.abs(Date.now() - data) < 2);
    if (2 < counter) {
      socket.dispatchEvent(new CloseEvent("close"));
      end.resolve();
    }
  });
  await socketRouter.get({ pathname: "/ws/date" }).handler!(
    { socket } as any,
  );
  await end;
});

Deno.test("/ws/date - error", async () => {
  const end = deferred();
  let counter = 0;
  const socket = new MockWebSocket((data: any) => {
    counter++;
    assert(Math.abs(Date.now() - data) < 2);
    if (2 < counter) {
      socket.dispatchEvent(new ErrorEvent("error"));
      end.resolve();
    }
  });
  await socketRouter.get({ pathname: "/ws/date" }).handler!(
    { socket } as any,
  );
  await end;
});
