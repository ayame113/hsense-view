import "https://deno.land/x/dotenv@v3.1.0/load.ts";
import { FirebaseRealtimeDatabase } from "./realtime_db.ts";
import { Database, Writer } from "./types.ts";

let database: Database;
try {
  database = new FirebaseRealtimeDatabase(
    JSON.parse(Deno.env.get("FIREBASE_CONFIG")!),
  );
} catch (error) {
  console.warn(error);
  database = {} as Database;
}

export { database };
export type { Database, Writer };
