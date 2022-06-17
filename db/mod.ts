import "https://deno.land/std@0.144.0/dotenv/load.ts";
import { FirebaseRealtimeDatabase } from "./realtime_db.ts";
// import { SQLiteDatabase } from "./sqlite.ts";
import { Database, Writer } from "./types.ts";
import { isDeploy } from "./utils.ts";

let database: Database;
try {
  if (isDeploy()) {
    // deno deployで動かしている場合はfirebaseを使う
    database = new FirebaseRealtimeDatabase(
      // 環境変数に入っているFIREBASE_CONFIGを使用して初期化
      JSON.parse(Deno.env.get("FIREBASE_CONFIG")!),
      {
        email: Deno.env.get("FIREASE_AUTH_ADMIN_EMAIL")!,
        password: Deno.env.get("FIREASE_AUTH_ADMIN_PASSWORD")!,
      },
    );
  } else {
    // deploy以外で動かしている場合はsqliteを使う
    const { SQLiteDatabase } = await import("./sqlite3.ts");
    database = new SQLiteDatabase();
  }
} catch (error) {
  console.warn(error);
  database = {} as Database;
}

export { database };
export type { Database, Writer };
