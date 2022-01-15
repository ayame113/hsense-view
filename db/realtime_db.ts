import { Deferred, deferred } from "https://deno.land/std@0.121.0/async/mod.ts";

// @deno-types="https://cdn.esm.sh/v58/firebase@9.6.0/app/dist/app/index.d.ts"
import {
  deleteApp,
  FirebaseApp,
  FirebaseOptions,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
// @deno-types="https://cdn.esm.sh/v58/firebase@9.6.0/database/dist/database/index.d.ts"
import {
  Database,
  DatabaseReference,
  enableLogging,
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
  set,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";

import type {
  Database as DatabaseInterface,
  Writer as WriterInterface,
} from "./types.ts";
import { hash } from "./utils.ts";

const DEFAULT_TIMEOUT = 120000;

/**
 * firebase appの死活監視をするクラス
 * dbプロパティに一定期間アクセスが無い場合は接続を切断する
 */
class FirebaseResources {
  #options: FirebaseOptions;
  #app: FirebaseApp;
  #db: Database;
  #wakeUpTimeoutId?: number;
  #wakeUpTimeout: number;
  #awake: boolean;
  #destructPromise: Deferred<void>;
  constructor(options: FirebaseOptions, { timeout }: { timeout: number }) {
    this.#options = options;
    this.#wakeUpTimeout = timeout;
    // wake up
    this.#app = initializeApp(options);
    this.#db = getDatabase(this.#app);
    this.#awake = true;
    this.#destructPromise = deferred();
  }
  get db() {
    this.#wakeUp();
    return this.#db;
  }
  #wakeUp() {
    if (!this.#awake) {
      // wake up
      this.#app = initializeApp(this.#options);
      this.#db = getDatabase(this.#app);
      this.#awake = true;
      this.#destructPromise = deferred();
    }
    clearTimeout(this.#wakeUpTimeoutId);
    this.#wakeUpTimeoutId = setTimeout(
      () => this.destructor(),
      this.#wakeUpTimeout,
    );
  }
  async destructor() {
    if (this.#awake) {
      this.#awake = false;
      this.#destructPromise.resolve();
      await deleteApp(this.#app);
    }
  }
  /**
   * リソースに値を紐づける
   * deleteAppされた場合に紐づけた値を適切に破棄する
   * 再度createAppされた場合に紐づけた値を再取得する
   * オブジェクトは返り値の関数
   * @param fn 紐付けする値を返す関数
   * @returns この関数を呼ぶと紐付けした値が返ってくる
   */
  link<T>(fn: (resources: FirebaseResources) => T): () => T {
    this.#wakeUp();
    let val = fn(this);
    let shouldReloadVal = false;
    this.#destructPromise.then(() => shouldReloadVal = true);
    return () => {
      this.#wakeUp();
      if (shouldReloadVal) {
        val = fn(this);
        shouldReloadVal = false;
        this.#destructPromise.then(() => shouldReloadVal = true);
      }
      return val;
    };
  }
}

export class FirebaseRealtimeDatabase implements DatabaseInterface {
  #resources: FirebaseResources;
  constructor(
    options: FirebaseOptions,
    { logging = false, timeout = DEFAULT_TIMEOUT }: {
      logging?: boolean;
      timeout?: number;
    } = {},
  ) {
    if (logging) {
      enableLogging(console.log);
    }
    this.#resources = new FirebaseResources(options, { timeout });
  }
  async cleanUp() {
    await this.#resources.destructor();
  }
  /**
   * idに紐づいた一意なトークンを返します。トークンをハッシュ化した値がDBに格納されます。
   * 既に紐づいたトークンが存在している場合はnullを返します。
   */
  async createToken(id: string): Promise<string | null> {
    const dataRef = ref(this.#resources.db, `tokenList/${id}`);
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
      get(ref(this.#resources.db, `tokenList/${id}`)),
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
  async getWriter(id: string, token: string) {
    if (!(await this.testToken(id, token))) {
      return null;
    }
    return new Writer(this.#resources, id);
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
          ref(this.#resources.db, `graphList/${id}`),
          limitToLast(limit),
        );
      } else {
        return query(
          ref(this.#resources.db, `graphList/${id}`),
          orderByChild("time"),
          endAt(fromTime, "time"),
          limitToLast(limit),
        );
      }
    })();
    const data = await get(dataRef);
    const res: { time: number; [key: string]: unknown }[] = [];
    data.forEach((val) => (res.push(val.val()), false));
    return res.reverse();
  }
  async deleteDataByTime(time: number) {
    //古いほうから取得して、timeを超えるまでnullを書き込む
    const resultPromises: Promise<void>[] = [];
    (await get(ref(this.#resources.db, "tokenList"))).forEach(({ key }) => {
      const dataRef = query(
        ref(this.#resources.db, `graphList/${key}`),
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
        await Promise.allSettled(promises);
      })());
      return false;
    });
    await Promise.allSettled(resultPromises);
  }
}

class Writer implements WriterInterface {
  readonly #getRef: () => DatabaseReference;
  constructor(resources: FirebaseResources, id: string) {
    this.#getRef = resources.link((resources) => {
      return ref(resources.db, `graphList/${id}`);
    });
  }
  async write(data: { time: number; [key: string]: number }) {
    if (typeof data.time !== "number") {
      return; // TODO: エラーハンドリング
    }
    await push(this.#getRef(), data);
  }
}

export async function deleteAllDataForTestDoNotUse(
  initializeOption: FirebaseOptions,
  id: string,
) {
  const app = initializeApp(initializeOption);
  const db = getDatabase(app);
  await set(ref(db, `graphList/${id}`), null);
  await set(ref(db, `tokenList/${id}`), null);
  await deleteApp(app);
}
