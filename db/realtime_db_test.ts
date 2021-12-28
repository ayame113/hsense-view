// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/dotenv@v3.1.0/load.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.117.0/testing/asserts.ts";
import { deadline, delay } from "https://deno.land/std@0.117.0/async/mod.ts";
import {
  deleteAllDataForTestDoNotUse,
  FirebaseRealtimeDatabase,
} from "./realtime_db.ts";

Deno.test("should run test with --location flag", () => {
  console.log(window.location);
});

Deno.test({
  name: "firebase realtime database",
  fn: async () => {
    return await deadline(
      (async () => {
        const id = `test-${Math.random()}`.replaceAll(".", "");
        const initializeOption = JSON.parse(
          Deno.env.get("FIREBASE_CONFIG_TEST")!,
        );
        await deleteAllDataForTestDoNotUse(initializeOption, id);
        await delay(5000);
        const db = new FirebaseRealtimeDatabase(initializeOption, {
          logging: false,
          timeout: 1000,
        });

        const token = await db.createToken(id);
        assert(token, "failed to get token");
        assert(!await db.testToken(id, "wrong token was passed"));
        assert(await db.testToken(id, token), "token is wrong");

        await delay(2000); // 適切にwakeUpされることを確認する

        const writer = await db.getWriter(id, token);
        assert(writer, "writer is null");
        for (let i = 0; i < 10; i++) {
          await writer.write({ time: i, content: `i: ${i}` as any });
        }
        await delay(2000); // 適切にwakeUpされることを確認する
        await writer.write({ time: 10, content: `i: 10` as any });

        assertEquals(await db.getDataByLimit(id, { fromTime: 4 }), [
          { time: 4, content: "i: 4" },
          { time: 3, content: "i: 3" },
          { time: 2, content: "i: 2" },
          { time: 1, content: "i: 1" },
          { time: 0, content: "i: 0" },
        ]);
        assertEquals(await db.getDataByLimit(id, { limit: 5 }), [
          { time: 10, content: "i: 10" },
          { time: 9, content: "i: 9" },
          { time: 8, content: "i: 8" },
          { time: 7, content: "i: 7" },
          { time: 6, content: "i: 6" },
        ]);
        assertEquals(await db.getDataByLimit(id, { fromTime: 3, limit: 2 }), [
          { time: 3, content: "i: 3" },
          { time: 2, content: "i: 2" },
        ]);

        await db.deleteDataByTime(5);
        assertEquals(await db.getDataByLimit(id), [
          { time: 10, content: "i: 10" },
          { time: 9, content: "i: 9" },
          { time: 8, content: "i: 8" },
          { time: 7, content: "i: 7" },
          { time: 6, content: "i: 6" },
        ]);
        await db.deleteDataByTime(10);
        assertEquals(await db.getDataByLimit(id), []);
        await db.cleanUp();
        await delay(5000);
        await deleteAllDataForTestDoNotUse(initializeOption, id);
        await delay(5000);
        console.log("fin");
      })(),
      30 * 1000,
    );
  },
  // https://github.com/firebase/firebase-js-sdk/issues/5783
  sanitizeOps: false,
  sanitizeResources: false,
});
