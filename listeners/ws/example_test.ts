// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.144.0/testing/asserts.ts";

import { socketRouter } from "../router.ts";
import "./example.ts";

Deno.test("/ws/test", async () => {
  const socket = new EventTarget();
  let counter = 0;
  // @ts-ignore: for test
  socket.send = (arg: string) => {
    assertEquals(arg, `${counter++}`);
  };
  await socketRouter.get({ pathname: "/ws/test" }).handler!(
    { socket } as any,
  );
  socket.dispatchEvent(new MessageEvent("message"));
  socket.dispatchEvent(new MessageEvent("message"));
  assertEquals(counter, 2);
});

Deno.test("/ws/test/:message", async () => {
  const socket = new EventTarget();
  let counter = 0;
  // @ts-ignore: for test
  socket.send = (arg: string) => {
    counter++;
    assertEquals(arg, "bar, foo");
  };
  const { handler, match } = socketRouter.get({ pathname: "/ws/test/foo" });
  await handler!({ socket, match } as any);
  socket.dispatchEvent(new MessageEvent("message", { data: "bar" }));
  socket.dispatchEvent(new MessageEvent("message", { data: "bar" }));
  assertEquals(counter, 2);
});
