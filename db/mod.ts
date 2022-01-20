import { config } from "https://deno.land/x/dotenv@v3.1.0/mod.ts";
import { FirebaseRealtimeDatabase } from "./realtime_db.ts";
// import { SQLiteDatabase } from "./sqlite.ts";
import { Database, Writer } from "./types.ts";
import { isDeploy } from "./utils.ts";

let database: Database;
try {
  if (isDeploy()) {
    database = new FirebaseRealtimeDatabase(
      JSON.parse(Deno.env.get("FIREBASE_CONFIG")!),
    );
  } else {
    // configAscyncじゃなくて同期バージョンを使う必要がある（deploy不可）
    config({ export: true });
    const { SQLiteDatabase } = await import("./sqlite3.ts");
    database = new SQLiteDatabase();
  }
} catch (error) {
  console.warn(error);
  database = {} as Database;
}

export { database };
export type { Database, Writer };
