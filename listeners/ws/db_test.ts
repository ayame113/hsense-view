// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.141.0/testing/asserts.ts";
import { deferred, delay } from "https://deno.land/std@0.141.0/async/mod.ts";

import { database } from "../../db/mod.ts";
import { mockFn, MockWebSocket } from "../../static/utils/test_mock.ts";
import { socketRouter } from "../router.ts";
import "./db.ts";

const deferredWithTimeout = (ms: number) => {
  const d = deferred();
  const id = setTimeout(() => {
    d.reject(`timeouted. (${ms}ms)`);
  }, ms);
  d.then(() => clearTimeout(id));
  return d;
};

Deno.test("/ws/send/:id - success", async () => {
  const end = deferredWithTimeout(10000);

  let writerCounter = 0;
  const getWriterMock = mockFn(database, "getWriter", (id, token) => {
    assertEquals(id, "apple");
    assertEquals(token, "testToken");
    return Promise.resolve({
      write(data) {
        assertEquals(data, { time: 100, foo: 0 });
        writerCounter++;
        if (1 < writerCounter) {
          end.resolve();
        }
        return Promise.resolve();
      },
    });
  });

  let channelCounter = 0;
  const channel = new BroadcastChannel("data.apple");
  channel.addEventListener("message", (e) => {
    assertEquals(e.data, '{"time":100,"foo":0}');
    channelCounter++;
  });

  const socket = new MockWebSocket();
  const { handler, match } = socketRouter.get({ pathname: "/ws/send/apple" });
  await handler!({ socket, match } as any);

  socket.dispatchEvent(
    new MessageEvent("message", { data: "testToken" }),
  );
  socket.dispatchEvent(
    new MessageEvent("message", { data: '{"time":100,"foo":0}' }),
  );
  socket.dispatchEvent(
    new MessageEvent("message", { data: '{"time":100,"foo":0}' }),
  );
  await end;
  await delay(100);
  socket.dispatchEvent(new CloseEvent("close"));
  channel.close();
  assertEquals(channelCounter, 2);
  assertEquals(writerCounter, 2);
  assertEquals(getWriterMock.calls.length, 1);
  getWriterMock.release();
});

Deno.test("/ws/send/:id - invalid token - fail", async () => {
  const end = deferredWithTimeout(10000);
  const socket = new MockWebSocket();

  let closeCallCount = 0;
  socket.close = (code, reason) => {
    closeCallCount++;
    assertEquals(code, 1008);
    assertEquals(reason, "error: failed to verify token.");
    end.resolve();
  };
  const { handler, match } = socketRouter.get({ pathname: "/ws/send/apple" });
  await handler!({ socket, match } as any);

  socket.dispatchEvent(new MessageEvent("message", { data: null }));
  await end;
  await delay(100);
  socket.dispatchEvent(new CloseEvent("close"));
  assertEquals(closeCallCount, 1);
});

Deno.test("/ws/send/:id - wrong token - fail", async () => {
  const end = deferredWithTimeout(10000);

  const getWriterMock = mockFn(database, "getWriter", (id, token) => {
    assertEquals(id, "apple");
    assertEquals(token, "testToken");
    return Promise.resolve(null);
  });

  const socket = new MockWebSocket();

  let closeCallCount = 0;
  socket.close = (code, reason) => {
    closeCallCount++;
    assertEquals(code, 1008);
    assertEquals(reason, "error: failed to verify token.");
    end.resolve();
  };
  const { handler, match } = socketRouter.get({ pathname: "/ws/send/apple" });
  await handler!({ socket, match } as any);

  socket.dispatchEvent(new MessageEvent("message", { data: "testToken" }));
  await end;
  await delay(100);
  socket.dispatchEvent(new CloseEvent("close"));
  assertEquals(getWriterMock.calls.length, 1);
  assertEquals(closeCallCount, 1);
  getWriterMock.release();
});

Deno.test("/ws/send/:id - no time property in data - fail", async () => {
  const end = deferredWithTimeout(10000);

  const getWriterMock = mockFn(database, "getWriter", (id, token) => {
    assertEquals(id, "apple");
    assertEquals(token, "testToken");
    return Promise.resolve({
      write() {
        throw new Error("unreachable");
      },
    });
  });

  const socket = new MockWebSocket();

  let closeCallCount = 0;
  socket.close = (code, reason) => {
    closeCallCount++;
    assertEquals(code, 1003);
    assertEquals(
      reason,
      "error: data format is invalid. The data must be json data with up to 20 keys in one hierarchy and an associative array of numbers, and the time property is required.",
    );
    end.resolve();
  };
  const { handler, match } = socketRouter.get({ pathname: "/ws/send/apple" });
  await handler!({ socket, match } as any);

  socket.dispatchEvent(new MessageEvent("message", { data: "testToken" }));
  socket.dispatchEvent(
    new MessageEvent("message", { data: "{}" }),
  );
  await end;
  await delay(100);
  socket.dispatchEvent(new CloseEvent("close"));
  assertEquals(getWriterMock.calls.length, 1);
  assertEquals(closeCallCount, 1);
  getWriterMock.release();
});

Deno.test("/ws/send/:id - not number data - fail", async () => {
  const end = deferredWithTimeout(10000);

  const getWriterMock = mockFn(database, "getWriter", (id, token) => {
    assertEquals(id, "apple");
    assertEquals(token, "testToken");
    return Promise.resolve({
      write() {
        throw new Error("unreachable");
      },
    });
  });

  const socket = new MockWebSocket();

  let closeCallCount = 0;
  socket.close = (code, reason) => {
    closeCallCount++;
    assertEquals(code, 1003);
    assertEquals(
      reason,
      "error: data format is invalid. The data must be json data with up to 20 keys in one hierarchy and an associative array of numbers, and the time property is required.",
    );
    end.resolve();
  };
  const { handler, match } = socketRouter.get({ pathname: "/ws/send/apple" });
  await handler!({ socket, match } as any);

  socket.dispatchEvent(new MessageEvent("message", { data: "testToken" }));
  socket.dispatchEvent(
    new MessageEvent("message", { data: '{"time":"aaa"}' }),
  );
  await end;
  await delay(100);
  socket.dispatchEvent(new CloseEvent("close"));
  assertEquals(getWriterMock.calls.length, 1);
  assertEquals(closeCallCount, 1);
  getWriterMock.release();
});

Deno.test("/ws/send/:id - max data length - fail", async () => {
  const end = deferredWithTimeout(10000);
  const obj = Object.fromEntries([...Array(21).keys()].map((v) => [v, v]));
  obj.time = 100;

  const getWriterMock = mockFn(database, "getWriter", (id, token) => {
    assertEquals(id, "apple");
    assertEquals(token, "testToken");
    return Promise.resolve({
      write() {
        throw new Error("unreachable");
      },
    });
  });

  const socket = new MockWebSocket();

  let closeCallCount = 0;
  socket.close = (code, reason) => {
    closeCallCount++;
    assertEquals(
      reason,
      "error: data format is invalid. The data must be json data with up to 20 keys in one hierarchy and an associative array of numbers, and the time property is required.",
    );
    assertEquals(code, 1003);
    end.resolve();
  };
  const { handler, match } = socketRouter.get({ pathname: "/ws/send/apple" });
  await handler!({ socket, match } as any);

  socket.dispatchEvent(new MessageEvent("message", { data: "testToken" }));
  socket.dispatchEvent(
    new MessageEvent("message", { data: JSON.stringify(obj) }),
  );
  await end;
  await delay(100);
  socket.dispatchEvent(new CloseEvent("close"));
  assertEquals(getWriterMock.calls.length, 1);
  assertEquals(closeCallCount, 1);
  getWriterMock.release();
});
