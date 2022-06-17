// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.144.0/testing/asserts.ts";

import { router } from "../router.ts";
import "./example.ts";

Deno.test("/api/test", async () => {
  const result = await router.GET.get({ pathname: "/api/test" }).handler!(
    {} as any,
  );
  assertEquals(result.body, "[API test]");
  assertEquals(result.type, ".html");
});

Deno.test("/api/test/:message", async () => {
  const { handler, match } = router.GET.get({
    pathname: "/api/test/hey",
  });
  const result = await handler!({ match } as any);
  assertEquals(result.body, "[API test]: hey");
  assertEquals(result.type, ".html");
});
