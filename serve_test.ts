import { assertEquals } from "https://deno.land/std@0.143.0/testing/asserts.ts";
import { delay } from "https://deno.land/std@0.143.0/async/mod.ts";

import { startServer } from "./serve.ts";

async function testServer(
  path: string,
  fn: (res: Response) => void | Promise<void>,
) {
  const { server, controller } = startServer();
  try {
    await fn(await fetch(new URL(path, "http://localhost:8000/")));
  } finally {
    controller.abort();
    await server;
  }
}

async function testWsServer(
  path: string,
  fn: (res: WebSocket, openPromise: Promise<unknown>) => void | Promise<void>,
) {
  const { server, controller } = startServer();
  const socket = new WebSocket(`${new URL(path, "ws://localhost:8000/")}`);
  const openPromise = new Promise((resolve) => {
    socket.addEventListener("open", resolve);
  });
  const closePromise = new Promise((resolve) => {
    socket.addEventListener("close", resolve);
  });
  try {
    await fn(socket, openPromise);
  } finally {
    socket.close();
    await closePromise;
    controller.abort();
    await server;
  }
}

Deno.test({
  name: "server notfound",
  async fn() {
    await testServer("/foobar", async (response) => {
      assertEquals(await response.text(), "404 Not Found");
      assertEquals(response.status, 404);
      assertEquals(
        response.headers.get("content-type"),
        "text/plain; charset=utf-8",
      );
    });
  },
});

Deno.test({
  name: "serve static file",
  async fn() {
    await testServer("/favicon.png", async (response) => {
      assertEquals(
        new Uint8Array(await response.arrayBuffer()),
        await Deno.readFile(
          new URL("./static/favicon.png", import.meta.url),
        ),
      );
      assertEquals(response.status, 200);
      assertEquals(response.headers.get("content-type"), "image/png");
    });
  },
});

Deno.test({
  name: "serve index.html",
  async fn() {
    await testServer("/", async (response) => {
      assertEquals(
        await response.text(),
        await Deno.readTextFile(
          new URL("./static/index.html", import.meta.url),
        ),
      );
      assertEquals(response.status, 200);
      assertEquals(
        response.headers.get("content-type"),
        "text/html; charset=utf-8",
      );
    });
  },
});

Deno.test({
  name: "serve static file with swc",
  async fn() {
    await testServer("/utils/router.ts", async (response) => {
      assertEquals(
        await response.text(),
        await Deno.readTextFile(
          new URL("./testdata/serve_static_file_with_swc.txt", import.meta.url),
        ),
      );
      assertEquals(response.status, 200);
      assertEquals(
        response.headers.get("content-type"),
        "application/javascript; charset=utf-8",
      );
    });
  },
});

Deno.test({
  name: "server api",
  async fn() {
    await testServer("/api/test", async (response) => {
      assertEquals(await response.text(), "[API test]");
      assertEquals(response.status, 200);
      assertEquals(
        response.headers.get("content-type"),
        "text/html; charset=utf-8",
      );
    });
  },
});

Deno.test({
  name: "server api 2",
  async fn() {
    await testServer("/api/test/hello", async (response) => {
      assertEquals(await response.text(), "[API test]: hello");
      assertEquals(response.status, 200);
      assertEquals(
        response.headers.get("content-type"),
        "text/html; charset=utf-8",
      );
    });
  },
});

Deno.test({
  name: "WebSocket server api",
  async fn() {
    let counter = 0;
    await testWsServer("/ws/test", async (socket, open) => {
      socket.addEventListener(
        "message",
        (event) => assertEquals(event.data, `${counter++}`),
      );
      await open;
      socket.send("hey");
      socket.send("hello");
      await delay(500);
    });
    assertEquals(counter, 2);
  },
});

Deno.test({
  name: "WebSocket server api 2",
  async fn() {
    await testWsServer("/ws/test/hello", async (socket, open) => {
      socket.addEventListener(
        "message",
        (event) => assertEquals(event.data, `hey, hello`),
      );
      await open;
      socket.send("hey");
    });
  },
});
