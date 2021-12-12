import { FirebaseRealtimeDatabase } from "./realtime_db.ts";

export type { Writer } from "./realtime_db.ts";

let database: FirebaseRealtimeDatabase;
try {
  database = new FirebaseRealtimeDatabase(
    JSON.parse(Deno.env.get("FIREBASE_CONFIG")!),
  );
} catch (error) {
  console.warn(error);
  database = {} as FirebaseRealtimeDatabase;
}

export { database };
