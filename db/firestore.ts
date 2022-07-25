import "https://deno.land/std@0.149.0/dotenv/load.ts";

import * as hex from "https://deno.land/std@0.149.0/encoding/hex.ts";
// @deno-types="https://cdn.esm.sh/v57/firebase@9.4.1/app/dist/app/index.d.ts"
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.4.1/firebase-app.js";
//import { initializeApp } from "https://cdn.skypack.dev/firebase@9.9.1/app";
// @deno-types="https://cdn.esm.sh/v58/firebase@9.4.1/firestore/dist/firestore/index.d.ts"
import {
  collection,
  CollectionReference,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  WriteBatch,
  writeBatch,
  //} from "https://cdn.skypack.dev/firebase@9.9.1/firestore";
} from "https://www.gstatic.com/firebasejs/9.4.1/firebase-firestore-lite.js";

const firebaseConfig = JSON.parse(Deno.env.get("FIREBASE_CONFIG")!);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** SHA-256を使用して文字列をハッシュ化します。 */
async function hash(message: string) {
  const encoded = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return decoder.decode(hex.encode(new Uint8Array(hashBuffer)));
}

//await setDoc(doc(db, "graphList", "apple"), { token: "token0000" });
/*await setDoc(doc(db, "graphList", "apple", "data", "time_20211231"), {
  token: "token0000",
});*/
/*
const citySnapshot = await getDocs(graphList);
const cityList = citySnapshot.docs.map((doc) => doc.data());
console.log(cityList);
*/

/**
 * idに紐づいた一意なトークンを返します。トークンをハッシュ化した値がDBに格納されます。
 * 既に紐づいたトークンが存在している場合はnullを返します。
 */
export async function getToken(id: string): Promise<string | null> {
  // TODO: トランザクション
  const docRef = doc(db, "graphList", id);
  if ((await getDoc(docRef)).exists()) {
    // 重複したトークンは取得できない（idに対するトークンを取得できるのは1回きり）
    return null;
  }
  const token = crypto.randomUUID();
  const hashedToken = await hash(token);
  await setDoc(docRef, { hashedToken });
  return token;
}

/** idとトークンの組み合わせが正しいか照合します。 */
export async function testToken(id: string, token: string): Promise<boolean> {
  // promise.allで並列処理
  const docSnap = await getDoc(doc(db, "graphList", id));
  return docSnap.exists() && docSnap.data().hashedToken === await hash(token);
}
//testToken("apple", "token");
//console.log(await getToken("nagano"));
//console.log(await testToken("nagano", "b604c77f-c332-4f04-a54a-2c0b2dee9ba7"));

/**
 * firebaseのバッチ処理を管理する
 * バッチの書き込み件数(500件)か10秒経過したらcommitする
 * 既にcommitされているバッチにaddするとエラーが出るので、addの前にisCommitedを確認する
 */
class BatchWriter {
  /**
   * コミット済みかどうか
   * コミット済みの場合はaddできない
   */
  isCommited = false;
  #count: number;
  #batch: WriteBatch;
  constructor() {
    this.#count = 0;
    this.#batch = writeBatch(db);
    setTimeout(async () => {
      await this.#commit();
    }, 10000);
  }
  async add(
    collectionRef: CollectionReference<DocumentData>,
    data: { [key: string]: unknown },
  ) {
    if (this.isCommited) {
      throw new Error("don't write committed batch");
    }
    this.#batch.set(doc(collectionRef), data);
    this.#count++;
    console.log(this.#count);
    if (500 <= this.#count) {
      await this.#commit();
    }
  }
  async #commit() {
    if (!this.isCommited) {
      this.isCommited = true;
      await this.#batch.commit();
    }
  }
}

export class DocWriter {
  isValid: boolean | undefined;
  #id: string;
  #collectionRef: CollectionReference<DocumentData>;
  #batchWriter?: BatchWriter | null;
  constructor(id: string) {
    this.#id = id;
    this.#collectionRef = collection(db, "graphList", id, "data");
  }
  async testToken(token: string) {
    const docSnap = await getDoc(doc(db, "graphList", this.#id));
    this.isValid = docSnap.exists() &&
      docSnap.data().hashedToken === await hash(token);
    return this.isValid;
  }
  async addData(data: { time: number; [field: string]: unknown }) {
    if (!this.isValid) {
      return false; // 異常系どうする？
    }
    if (!this.#batchWriter || this.#batchWriter.isCommited) {
      this.#batchWriter = new BatchWriter();
    }
    await this.#batchWriter.add(this.#collectionRef, data);
    return true;
  }
}
//*
const adder = new DocWriter("nagano");
await adder.testToken("b604c77f-c332-4f04-a54a-2c0b2dee9ba7");
console.time("a");
let i = 0;
const intervalId = setInterval(async () => {
  await adder.addData({ time: Date.now(), foo: `bar${i}` });
  if (100 <= i++) {
    clearInterval(intervalId);
    console.timeEnd("a");
    console.log(i);
  }
}, 10);
//*/

/** from(ミリ秒)からto(ミリ秒)までのデータを取得する */
export async function getDataByTime(
  id: string,
  option: { from: number; to: number },
) {
  return (await getDocs(query(
    collection(db, "graphList", id, "data"),
    orderBy("time", "desc"), // 新しい方から順に
    where("time", "<", option.to),
    where("time", ">", option.from),
  ))).docs.map((v) => {
    return v.data();
  });
}
//console.log(
//  await getDataByTime("apple", { from: 1637487300333, to: Date.now() }),
//);
export async function getDataByLimit(id: string, limits: number) {
  return (await getDocs(query(
    collection(db, "graphList", id, "data"),
    orderBy("time", "desc"), // 新しい方から順に
    limit(limits),
  ))).docs.map((v) => {
    return v.data();
  });
}

//(await getDataByLimit("apple", 200)).map((v) => console.log(v));

/** time以前のデータを削除する */
export async function deleteByTime(time: number) {
  let batch = writeBatch(db);
  let count = 0;
  await Promise.all((await getDocs(collection(db, "graphList"))).docs.map(
    async (d) => {
      await Promise.all((await getDocs(query(
        collection(d.ref, "data"),
        where("time", "<", time),
      ))).docs.map(async (d) => {
        batch.delete(d.ref);
        count++;
        if (500 <= count) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }));
    },
  ));
  await batch.commit();
}
//await deleteByTime(Date.now());
