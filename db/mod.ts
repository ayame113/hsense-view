import "https://deno.land/x/dotenv@v3.1.0/load.ts";
import { FirebaseRealtimeDatabase } from "./realtime_db.ts";
// import { SQLiteDatabase } from "./sqlite.ts";
import { SQLiteDatabase } from "./sqlite3.ts";
import { Database, Writer } from "./types.ts";
import { isDeploy } from "./utils.ts";

let database: Database;
try {
  if (isDeploy()) {
    database = new FirebaseRealtimeDatabase(
      JSON.parse(Deno.env.get("FIREBASE_CONFIG")!),
    );
  } else {
    database = new SQLiteDatabase();
  }
} catch (error) {
  console.warn(error);
  database = {} as Database;
}

export { database };
export type { Database, Writer };
