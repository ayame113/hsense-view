import { Database } from "https://deno.land/x/sqlite3@0.3.0/mod.ts";
import { ensureDir } from "https://deno.land/std@0.122.0/fs/mod.ts";
import { delay } from "https://deno.land/std@0.122.0/async/mod.ts";

import { hash } from "./utils.ts";
import type {
  Database as DatabaseInterface,
  Writer as WriterInterface,
} from "./types.ts";

const DEFAULT_TIMEOUT = 120000;

class SQLiteResources {
  static #idToDB = new Map<string, Database>();
  static #idToTimeout = new Map<string, number>();
  static {
    globalThis.addEventListener("unload", () => {
      console.log("unload");
      this.cleanUp();
    });
    globalThis.addEventListener("error", () => {
      console.log("error");
      this.cleanUp();
    });
  }
  static async getDB(id: string, deleteTimeout: number) {
    if (id.includes("/") || id.includes(".")) {
      throw new Error("id cannot include . or /");
    }
    const db = this.#idToDB.get(id) ?? await this.#createDB(id);
    clearTimeout(this.#idToTimeout.get(id));
    this.#idToTimeout.set(
      id,
      setTimeout(() => this.#deleteDB(id), deleteTimeout),
    );
    return db;
  }
  static async #createDB(id: string) {
    await ensureDir("./graph_data");
    const db = new Database(`./graph_data/${id}.db`, { create: true });
    this.#idToDB.set(id, db);
    await delay(100);
    // テーブル1
    // key: "id",val: ハッシュ値
    db.execute(`CREATE TABLE IF NOT EXISTS hash(
      id TEXT PRIMARY KEY,
      hash TEXT NOT NULL
    )`);
    // テーブル2
    // key: 時刻(unix time),val: json値
    db.execute(`CREATE TABLE IF NOT EXISTS data(
      time INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    )`);
    return db;
  }
  static #deleteDB(id: string) {
    this.#idToDB.get(id)?.close();
    this.#idToDB.delete(id);
  }
  static cleanUp() {
    for (const [id, db] of this.#idToDB) {
      console.log("delete", id);
      db.close();
    }
  }
}

export class SQLiteDatabase implements DatabaseInterface {
  #timeout: number;
  constructor({ timeout }: { timeout?: number } = {}) {
    this.#timeout = timeout ?? DEFAULT_TIMEOUT;
  }
  async createToken(id: string): Promise<string | null> {
    const token = crypto.randomUUID();
    const hashedToken = await hash(token);
    const db = await SQLiteResources.getDB(id, this.#timeout);
    let result: string | null = null;
    const data = db.queryArray("select hash from hash where id = 'id'");
    if (!data.length) {
      db.queryArray("INSERT INTO hash VALUES ('id', ?)", hashedToken);
      result = token;
    }
    return result;
  }
  async testToken(id: string, token: string) {
    const db = await SQLiteResources.getDB(id, this.#timeout);
    const data = db.queryArray("select hash from hash where id = 'id'");
    const expectedHashedToken = await hash(token);
    if (!data.length) {
      return false;
    }
    const [[hashedToken]] = data;
    return hashedToken === expectedHashedToken;
  }
  async getWriter(id: string, token: string) {
    if (!await this.testToken(id, token)) {
      return null;
    }
    return new Writer(id, this.#timeout);
  }
  async getDataByLimit(
    id: string,
    { limit, fromTime }: {
      limit?: number | undefined;
      fromTime?: number | undefined;
    } = {},
  ): Promise<{ [key: string]: unknown; time: number }[]> {
    const hasLimit = limit != null;
    const hasFromTime = fromTime != null;
    const db = await SQLiteResources.getDB(id, this.#timeout);
    if (hasLimit && hasFromTime) {
      const data = db.queryArray<string[]>(
        "SELECT data FROM data WHERE time <= ? ORDER BY time DESC LIMIT ?",
        fromTime,
        limit,
      );
      return data.map(([r]) => JSON.parse(r));
    } else if (hasLimit && !hasFromTime) {
      const data = db.queryArray<string[]>(
        "SELECT data FROM data ORDER BY time DESC LIMIT ?",
        limit,
      );
      return data.map(([r]) => JSON.parse(r));
    } else if (!hasLimit && hasFromTime) {
      const data = db.queryArray<string[]>(
        "SELECT data FROM data WHERE time <= ? ORDER BY time DESC",
        fromTime,
      );
      return data.map(([r]) => JSON.parse(r));
    } else if (!hasLimit && !hasFromTime) {
      const data = db.queryArray<string[]>(
        "SELECT data FROM data ORDER BY time DESC",
      );
      return data.map(([r]) => JSON.parse(r));
    } else {
      throw new Error("unreachable");
    }
  }
  // deno-lint-ignore require-await
  async deleteDataByTime(_time: number) {
    throw new Error("unimplemented");
  }
  cleanUp() {
    SQLiteResources.cleanUp();
  }
}

class Writer implements WriterInterface {
  #id: string;
  #timeout: number;
  constructor(id: string, timeout: number) {
    this.#id = id;
    this.#timeout = timeout;
  }
  async write(data: { [key: string]: number; time: number }) {
    const db = await SQLiteResources.getDB(this.#id, this.#timeout);
    db.execute(
      "INSERT INTO data VALUES (?, ?)",
      Math.round(data.time),
      JSON.stringify(data),
    );
  }
}
