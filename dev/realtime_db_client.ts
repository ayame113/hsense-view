// 計測用コード

import "https://deno.land/std@0.140.0/dotenv/load.ts";

// @deno-types="https://cdn.esm.sh/v58/firebase@9.6.0/app/dist/app/index.d.ts"
import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
// @deno-types="https://cdn.esm.sh/v58/firebase@9.6.0/database/dist/database/index.d.ts"
import {
  getDatabase,
  onValue,
  ref,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

const config = JSON.parse(Deno.env.get("FIREBASE_CONFIG_TEST")!);
const app = initializeApp(config);
const db = getDatabase(app);

const dbRef = ref(db);
onValue(dbRef, (snapshot) => {
  const data = snapshot.val();
  console.log(Date.now() - data);
});
