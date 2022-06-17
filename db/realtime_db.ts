import { Deferred, deferred } from "https://deno.land/std@0.144.0/async/mod.ts";

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
import {
  getAuth,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";

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
  /** firebase config */
  #options: FirebaseOptions;
  /** firebaseを操作するクラス */
  #app: FirebaseApp;
  /** データベースへの参照 */
  #db: Promise<Database>;
  /** 接続切断に使うsetTimeoutのtimeoutId */
  #wakeUpTimeoutId?: number;
  /** 何秒間接続が無ければ接続を切断するか */
  #wakeUpTimeout: number;
  /** DB接続が生きているかどうか */
  #awake: boolean;
  /** DB接続を閉じたい時に、このdeffredをresolveする */
  #destructPromise: Deferred<void>;
  /** ログイン用のemail */
  #email: string;
  /** ログイン用のパスワード */
  #password: string;
  constructor(
    options: FirebaseOptions,
    { email, password }: { email: string; password: string },
    { timeout }: { timeout: number },
  ) {
    this.#options = options;
    this.#wakeUpTimeout = timeout;
    this.#email = email;
    this.#password = password;
    // wake up
    this.#app = initializeApp(this.#options);
    this.#awake = true;
    this.#destructPromise = deferred();
    const authPromise = auth(this.#app, this.#email, this.#password);
    this.#db = authPromise.then(() => getDatabase(this.#app));
  }
  /** dbを取得するプロパティ */
  get db() {
    this.#wakeUp();
    return this.#db;
  }
  /**
   * DBへの読み書きが発生するたびにこの関数が呼ばれる
   * 一定期間この関数が呼ばれない場合、destructor()を呼びDBとの接続を切断する
   */
  #wakeUp() {
    clearTimeout(this.#wakeUpTimeoutId);
    if (!this.#awake) {
      // wake up
      this.#app = initializeApp(this.#options);
      this.#awake = true;
      this.#destructPromise = deferred();
      const authPromise = auth(this.#app, this.#email, this.#password);
      // 場合によっては破棄済みのDBを取得しようとしてエラー？
      this.#db = authPromise.then(() => getDatabase(this.#app));
    }
    this.#wakeUpTimeoutId = setTimeout(
      () => this.destructor(),
      this.#wakeUpTimeout,
    );
  }
  /**
   * 終了時に呼ばれる関数
   * constructorと対になっている
   */
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

/** firebase realtime databaseを操作するクラス */
export class FirebaseRealtimeDatabase implements DatabaseInterface {
  #resources: FirebaseResources;
  constructor(
    options: FirebaseOptions,
    auth: { email: string; password: string },
    { logging = false, timeout = DEFAULT_TIMEOUT }: {
      logging?: boolean;
      timeout?: number;
    } = {},
  ) {
    if (logging) {
      enableLogging(console.log);
    }
    this.#resources = new FirebaseResources(options, auth, { timeout });
  }
  /** データベース接続を破棄する */
  async cleanUp() {
    await this.#resources.destructor();
  }
  /**
   * idに紐づいた一意なトークンを返します。トークンをハッシュ化した値がDBに格納されます。
   * 既に紐づいたトークンが存在している場合はnullを返します。
   */
  async createToken(id: string): Promise<string | null> {
    const dataRef = ref(await this.#resources.db, `tokenList/${id}`);
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
      get(ref(await this.#resources.db, `tokenList/${id}`)),
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
    const db = await this.#resources.db;
    const dataRef = (() => {
      if (fromTime == undefined) {
        return query(
          ref(db, `graphList/${id}`),
          limitToLast(limit),
        );
      } else {
        return query(
          ref(db, `graphList/${id}`),
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
  /** 引数に渡した時刻より古いデータを削除する */
  async deleteDataByTime(time: number) {
    //古いほうから取得して、timeを超えるまでnullを書き込む
    const resultPromises: Promise<void>[] = [];
    const db = await this.#resources.db;
    (await get(ref(db, "tokenList"))).forEach(({ key }) => {
      const dataRef = query(
        ref(db, `graphList/${key}`),
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

/**
 * データを書き込むためのクラス
 * getWriter()の戻り値
 */
class Writer implements WriterInterface {
  readonly #getRef: () => Promise<DatabaseReference>;
  constructor(resources: FirebaseResources, id: string) {
    this.#getRef = resources.link(async (resources) => {
      return ref(await resources.db, `graphList/${id}`);
    });
  }
  /** データを書き込む */
  async write(data: { time: number; [key: string]: number }) {
    if (typeof data.time !== "number") {
      console.warn("writting db was ignored");
      return; // TODO: エラーハンドリング
    }
    await push(await this.#getRef(), data);
  }
}

/** (開発者用のダミーアカウントで)ログインする */
async function auth(app: FirebaseApp, email: string, password: string) {
  // データーベースには認証が通った人しか書き込めないようになっているので、この関数を呼んで認証する。
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);
}

/** テスト用 データベースのデータを全部削除する。使うな！！ */
export async function deleteAllDataForTestDoNotUse(
  initializeOption: FirebaseOptions,
  id: string,
  { email, password }: { email: string; password: string },
) {
  const app = initializeApp(initializeOption);
  await auth(app, email, password);
  const db = getDatabase(app);
  await set(ref(db, `graphList/${id}`), null);
  await set(ref(db, `tokenList/${id}`), null);
  await deleteApp(app);
}
