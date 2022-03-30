/** データベース接続用のクラスが実装するinterface */
export interface Database {
  /** アクセストークンを作成 */
  createToken(id: string): Promise<string | null>;
  /** アクセストークンが正しいか検証 */
  testToken(id: string, token: string): Promise<boolean>;
  /** 書き込み用クラスを取得 */
  getWriter(id: string, token: string): Promise<Writer | null>;
  /** データベースからデータを取得 */
  getDataByLimit(id: string, opttion?: {
    limit?: number;
    fromTime?: number;
  }): Promise<{
    [key: string]: unknown;
    time: number;
  }[]>;
  // データベースからデータを削除
  deleteDataByTime(time: number): Promise<void>;
}

/** 書き込み用クラス */
export interface Writer {
  /** データを書きこみ */
  write(data: { time: number; [key: string]: number }): Promise<void>;
}
