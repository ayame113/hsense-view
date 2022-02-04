import { config } from "https://deno.land/x/dotenv@v3.1.0/mod.ts";
import { FirebaseRealtimeDatabase } from "./realtime_db.ts";
// import { SQLiteDatabase } from "./sqlite3.ts";
// import { SQLiteDatabase } from "./sqlite.ts";
import { Database, Writer } from "./types.ts";
import { isDeploy } from "./utils.ts";

if (!isDeploy()) {
  throw new Error("https://github.com/ayame113/socket-graph/pull/30", {
    cause: "https://github.com/denoland/deploy_feedback/issues/166",
  });
}

let database: Database;
try {
  if (isDeploy()) {
    database = new FirebaseRealtimeDatabase(
      JSON.parse(Deno.env.get("FIREBASE_CONFIG")!),
    );
  } else {
    // configAscyncじゃなくて同期バージョンを使う必要がある（deploy不可）
    config({ export: true });
    // 動的importが使えない
    // const { SQLiteDatabase } = await import("./sqlite3.ts");
    throw new Error("https://github.com/ayame113/socket-graph/pull/30", {
      cause: "https://github.com/denoland/deploy_feedback/issues/166",
    });
    // database = new SQLiteDatabase();
  }
} catch (error) {
  console.warn(error);
  database = {} as Database;
}

export { database };
export type { Database, Writer };
