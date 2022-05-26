import { Database } from "https://deno.land/x/sqlite3@0.4.2/mod.ts";
import { ensureDir } from "https://deno.land/std@0.140.0/fs/mod.ts";
import { delay } from "https://deno.land/std@0.140.0/async/mod.ts";

import { hash } from "./utils.ts";
import type {
  Database as DatabaseInterface,
  Writer as WriterInterface,
} from "./types.ts";

const DEFAULT_TIMEOUT = 120000;

/** SQLiteの接続を管理するクラス */
class SQLiteResources {
  /** idごとに1つのDBを作成する */
  static #idToDB = new Map<string, Database>();
  /** 一定期間が経過したらDB接続を閉じるためのtimeoutId */
  static #idToTimeout = new Map<string, number>();
  static {
    // この部分は最初に1度だけ実行されます
    globalThis.addEventListener("unload", () => {
      console.log("unload");
      this.cleanUp();
    });
    globalThis.addEventListener("error", () => {
      console.log("error");
      this.cleanUp();
    });
  }
  /**
   * idに対応するdetabaseを取得
   * @param  id データベースのid
   * @param  deleteTimeout 何ミリ秒後に接続を破棄するか
   */
  static async getDB(id: string, deleteTimeout: number) {
    if (id.includes("/") || id.includes(".")) {
      throw new Error("id cannot include . or /");
    }
    // データベース接続がなければcreateDBで作成
    const db = this.#idToDB.get(id) ?? await this.#createDB(id);
    clearTimeout(this.#idToTimeout.get(id));
    this.#idToTimeout.set(
      id,
      setTimeout(() => this.#deleteDB(id), deleteTimeout),
    );
    return db;
  }
  /** データベースを作成する */
  static async #createDB(id: string) {
    // データの保存場所は./graph_data/ディレクトリ
    await ensureDir("./graph_data");
    const db = new Database(`./graph_data/${id}.db`, { create: true });
    this.#idToDB.set(id, db);
    await delay(100);
    // テーブル1: idに対応するアクセストークンのハッシュ値を格納するクラス
    // 1列目：id（重複無し=PRIMARY KEY）
    // 2列目：アクセストークンのハッシュ値（nullは入力不可=NOT NULL）
    db.execute(`CREATE TABLE IF NOT EXISTS hash(
      id TEXT PRIMARY KEY,
      hash TEXT NOT NULL
    )`);
    // テーブル2：時刻とデータを保存するテーブル
    // 1列目：時刻（unix timeで保存）
    // 2列目：時刻に対応するデータ（JSON文字列で保存）
    db.execute(`CREATE TABLE IF NOT EXISTS data(
      time INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    )`);
    return db;
  }
  /** データベースの接続を解除 */
  static #deleteDB(id: string) {
    this.#idToDB.get(id)?.close();
    this.#idToDB.delete(id);
  }
  /** 全てのデータベースへの接続を解除 */
  static cleanUp() {
    for (const [id, db] of this.#idToDB) {
      console.log("delete", id);
      db.close();
      // ここdeleteしなくてもいいのか？
    }
  }
}

/** SQLiteデータベースを操作するクラス */
export class SQLiteDatabase implements DatabaseInterface {
  /**何ミリ秒間アクセスが無かったら接続を閉じるか*/
  #timeout: number;
  constructor({ timeout }: {
    /**何ミリ秒間アクセスが無かったら接続を閉じるか*/ timeout?: number;
  } = {}) {
    this.#timeout = timeout ?? DEFAULT_TIMEOUT;
  }
  /** アクセストークンを作成する */
  async createToken(id: string): Promise<string | null> {
    // crypto.randomUUIDでランダムなアクセストークンを生成
    const token = crypto.randomUUID();
    // アクセストークンをハッシュ化
    const hashedToken = await hash(token);
    // idに対応するデータベースを取得
    // ここPromise.allで並列化してもいいかも？
    const db = await SQLiteResources.getDB(id, this.#timeout);
    try {
      db.queryArray("INSERT INTO hash VALUES ('id', ?)", hashedToken);
      // トークンの保存が成功したらトークンをreturnする
      return token;
    } catch {
      // uniqe idが重複したらエラーが出る
      return null;
    }
  }
  /** idとアクセストークンが正しい組み合わせかどうか検証する */
  async testToken(id: string, token: string) {
    // dbを取得
    const db = await SQLiteResources.getDB(id, this.#timeout);
    // idに対応するアクセストークンのハッシュ値（dbから取得したもの）
    const data = db.queryArray("select hash from hash where id = 'id'");
    // アクセストークンのハッシュ値（引数から生成したもの）
    const expectedHashedToken = await hash(token);
    if (!data.length) {
      return false;
    }
    const [[hashedToken]] = data;
    // 2つのアクセストークンを比較して同じかどうか
    return hashedToken === expectedHashedToken;
  }
  async getWriter(id: string, token: string) {
    // 先にアクセストークンが正しいか検証
    if (!await this.testToken(id, token)) {
      return null;
    }
    // アクセストークンが正しい場合はWriterを返す
    return new Writer(id, this.#timeout);
  }
  // データを取得する
  async getDataByLimit(
    id: string,
    { limit, fromTime }: {
      /** 先頭からlimit個分のデータを取得 */
      limit?: number | undefined;
      /** fromTimeより前のデータに限定して取得 */
      fromTime?: number | undefined;
    } = {},
  ): Promise<{ [key: string]: unknown; time: number }[]> {
    const hasLimit = limit != null;
    const hasFromTime = fromTime != null;
    // databaseを取得
    const db = await SQLiteResources.getDB(id, this.#timeout);
    if (hasLimit && hasFromTime) {
      // limitあり、fromTimeあり
      const data = db.queryArray<string[]>(
        "SELECT data FROM data WHERE time <= ? ORDER BY time DESC LIMIT ?",
        fromTime,
        limit,
      );
      return data.map(([r]) => JSON.parse(r));
    } else if (hasLimit && !hasFromTime) {
      // limitあり、fromTimeなし
      const data = db.queryArray<string[]>(
        "SELECT data FROM data ORDER BY time DESC LIMIT ?",
        limit,
      );
      return data.map(([r]) => JSON.parse(r));
    } else if (!hasLimit && hasFromTime) {
      // limitなし、fromTimeあり
      const data = db.queryArray<string[]>(
        "SELECT data FROM data WHERE time <= ? ORDER BY time DESC",
        fromTime,
      );
      return data.map(([r]) => JSON.parse(r));
    } else if (!hasLimit && !hasFromTime) {
      // limitなし、fromTimeなし
      const data = db.queryArray<string[]>(
        "SELECT data FROM data ORDER BY time DESC",
      );
      return data.map(([r]) => JSON.parse(r));
    } else {
      throw new Error("unreachable");
    }
  }
  /** 時間を指定してデータを削除（使わないので未実装） */
  // deno-lint-ignore require-await
  async deleteDataByTime(_time: number) {
    throw new Error("unimplemented");
  }
  /** データベース接続をすべて閉じる */
  cleanUp() {
    SQLiteResources.cleanUp();
  }
}

/** 書き込み用クラス */
class Writer implements WriterInterface {
  #id: string;
  #timeout: number;
  constructor(id: string, timeout: number) {
    this.#id = id;
    this.#timeout = timeout;
  }
  /** データを書き込む */
  async write(data: { [key: string]: number; time: number }) {
    const db = await SQLiteResources.getDB(this.#id, this.#timeout);
    db.execute(
      "INSERT INTO data VALUES (?, ?)",
      Math.round(data.time), // 1ミリ秒以下の小数部分は四捨五入
      JSON.stringify(data),
    );
  }
}
