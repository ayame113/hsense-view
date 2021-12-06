import { FirebaseRealtimeDatabase } from "./realtime_db.ts";
export type { Writer } from "./realtime_db.ts";

export const database = new FirebaseRealtimeDatabase(
  JSON.parse(Deno.env.get("FIREBASE_CONFIG")!),
);
