import "https://deno.land/x/dotenv@v3.1.0/load.ts";

// @deno-types="https://cdn.esm.sh/v58/firebase@9.4.1/app/dist/app/index.d.ts"
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.4.1/firebase-app.js";
// @deno-types="https://cdn.esm.sh/v58/firebase@9.4.1/database/dist/database/index.d.ts"
import {
  child,
  Database,
  DatabaseReference,
  endAt,
  get,
  getDatabase,
  limitToLast,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/9.4.1/firebase-database.js";

import { hash } from "./utils.ts";

export class FirebaseRealtimeDatabase {
  #db: Database;
  constructor(...options: Parameters<typeof initializeApp>) {
    const app = initializeApp(...options);
    this.#db = getDatabase(app);
  }
  /**
   * idに紐づいた一意なトークンを返します。トークンをハッシュ化した値がDBに格納されます。
   * 既に紐づいたトークンが存在している場合はnullを返します。
   */
  async createToken(id: string): Promise<string | null> {
    const dataRef = ref(this.#db, `tokenList/${id}`);
    let result: string | null = null;
    const token = crypto.randomUUID();
    const hashedToken = await hash(token);
    // runTransaction内でpromise使えないかも？
    await runTransaction(dataRef, (ref) => {
      if (ref !== null) {
        // 重複したトークンは取得できない（idに対するトークンを取得できるのは1回きり）
        result = null;
        return ref;
      }
      result = token;
      return { hashedToken };
    });
    return result;
  }

  /** idとトークンの組み合わせが正しいか照合します。 */
  async testToken(id: string, token: string): Promise<boolean> {
    const [res, expectedHashedToken] = await Promise.all([
      get(ref(this.#db, `tokenList/${id}`)),
      hash(token),
    ]);
    return res.exists() && res.val()?.hashedToken === expectedHashedToken;
  }
  /**
   * データ書き込み用のクラスを取得する
   * ```ts
   * const writer = db.getWriter(id, token);
   * if (!writer) {
   *   console.log("token is wrong");
   * }
   * writer.write(data);
   * ```
   */
  getWriter(id: string, token: string) {
    if (!this.testToken(id, token)) {
      return null;
    }
    return new Writer(this.#db, id);
  }
  /**
   * fromTimeから遡ってlimit個分のデータを取得する
   * fromTimeが指定されていない場合、最新のデータからlimit個分取得する
   * limitのデフォルト値は50
   */
  async getDataByLimit(
    id: string,
    { limit = 50, fromTime }: { limit?: number; fromTime?: number } = {},
  ) {
    const dataRef = (() => {
      if (fromTime == undefined) {
        return query(
          ref(this.#db, `graphList/${id}`),
          limitToLast(limit),
        );
      } else {
        return query(
          ref(this.#db, `graphList/${id}`),
          orderByChild("time"),
          endAt(fromTime, "time"),
          limitToLast(limit),
        );
      }
    })();
    const data = await get(dataRef);
    const res: { time: number; [key: string]: unknown }[] = [];
    data.forEach((val) => (res.push(val.val()), false));
    return res;
  }
  async deleteDataByTime(time: number) {
    //古いほうから取得して、timeを超えるまでnullを書き込む
    const resultPromises: Promise<void>[] = [];
    (await get(ref(this.#db, "tokenList"))).forEach(({ key }) => {
      const dataRef = query(
        ref(this.#db, `graphList/${key}`),
        orderByChild("time"),
        endAt(time, "time"),
      );
      resultPromises.push((async () => {
        const data = await get(dataRef);
        const promises: Promise<void>[] = [];
        data.forEach(({ ref }) => {
          promises.push(remove(ref));
          return false;
        });
        await Promise.all(promises);
      })());
      return false;
    });
    await Promise.all(resultPromises);
  }
}

class Writer {
  #ref: DatabaseReference;
  constructor(db: Database, id: string) {
    this.#ref = ref(db, `graphList/${id}`);
  }
  async write(data: { time: number; [key: string]: unknown }) {
    await push(this.#ref, data);
  }
}

/*
const docRef = ref(db, "graphList/id");
//console.log(docRef);

await set(docRef, {
  username: "name",
  email: "email",
  profile_picture: "imageUrl",
});

await get(child(ref(db), `graphList`)).then(
  (snapshot) => {
    console.log("success");

    if (snapshot.exists()) {
      console.log(snapshot.val());
    } else {
      console.log("No data available");
    }
  },
).catch((error) => {
  console.error(error);
});
*/
