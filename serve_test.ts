import { assertEquals } from "https://deno.land/std@0.113.0/testing/asserts.ts";

import { serve } from "./serve.ts";

Deno.test({
  name: "server test",
  async fn() {
    const { server, controller } = serve();
    {
      const response = await fetch("http://localhost:8080/");
      assertEquals(
        await response.text(),
        'Hello World from <a href="https://github.com/ayame113/deno_deploy_template">ayame113/deno_deploy_template</a> !',
      );
      assertEquals(
        response.headers.get("content-type"),
        "text/html; charset=utf-8",
      );
    }
    {
      const response = await fetch("http://localhost:8080/favicon.png");
      assertEquals(
        new Uint8Array(await response.arrayBuffer()),
        await Deno.readFile(
          new URL("./static/favicon.png", import.meta.url),
        ),
      );
      assertEquals(
        response.headers.get("content-type"),
        "image/png",
      );
    }
    {
      const response = await fetch("http://localhost:8080/foobar");
      assertEquals(
        await response.text(),
        "404 Not Found\n",
      );
      assertEquals(
        response.status,
        404,
      );
      assertEquals(
        response.headers.get("content-type"),
        "text/plain;charset=UTF-8",
      );
    }
    controller.abort();
    await server;
  },
});
