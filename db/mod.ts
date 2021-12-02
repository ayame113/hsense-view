import { FirebaseRealtimeDatabase } from "./realtime_db.ts";

export const db = new FirebaseRealtimeDatabase(
  JSON.parse(Deno.env.get("FIREBASE_CONFIG")!),
);
