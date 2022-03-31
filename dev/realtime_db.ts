// 計測用コード

import { delay } from "https://deno.land/std@0.132.0/async/delay.ts";
import "https://deno.land/std@0.132.0/dotenv/load.ts";

// @deno-types="https://cdn.esm.sh/v58/firebase@9.6.0/app/dist/app/index.d.ts"
import {
  deleteApp,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
// @deno-types="https://cdn.esm.sh/v58/firebase@9.6.0/database/dist/database/index.d.ts"
import {
  getDatabase,
  ref,
  set,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

const config = JSON.parse(Deno.env.get("FIREBASE_CONFIG_TEST")!);
const app = initializeApp(config);
const db = getDatabase(app);

const dbRef = ref(db);

const wait = 1000;
for (let i = 0; i < 100; i++) {
  await delay(wait);
  await set(dbRef, Date.now());
}
deleteApp(app);
console.log("finish");
