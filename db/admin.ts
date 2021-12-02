/*

esm.shが直し中なのでまた後で試す
 */

// import "https://cdn.skypack.dev/firebase-admin@10.0.0/lib/app";
import "https://esm.sh/firebase-admin@10.0.0/app";

// /@deno-types="https://cdn.esm.sh/v54/firebase-admin@10.0.0/lib/index.d.ts"
import {
  credential,
  initializeApp,
} from "https://esm.sh/firebase-admin@10.0.0/app";
//} from "https://cdn.skypack.dev/firebase-admin@10.0.0/app/index";
//} from "https://jspm.dev/firebase-admin@10.0.0/app";
/*

/*
import admin from "https://esm.sh/firebase-admin@10.0.0";
console.log(admin);

const {
  credential,
  initializeApp,
} = admin;
* /
// ENVから読む
const cert = {
  projectId: Deno.env.get("FIREBASE_PROJECT_ID"),
  clientEmail: Deno.env.get("FIREBASE_CLIENT_EMAIL"),
  privateKey: Deno.env.get("FIREBASE_PRIVATE_KEY")!.replace(/\\n/g, "\n"),
};
initializeApp({
  credential: credential.cert(cert),
});
*/
