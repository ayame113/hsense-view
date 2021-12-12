export interface Database {
  createToken(id: string): Promise<string | null>;
  testToken(id: string, token: string): Promise<boolean>;
  getWriter(id: string, token: string): Promise<Writer | null>;
  getDataByLimit(id: string, { limit, fromTime }?: {
    limit?: number;
    fromTime?: number;
  }): Promise<{
    [key: string]: unknown;
    time: number;
  }[]>;
  deleteDataByTime(time: number): Promise<void>;
}
export interface Writer {
  write(data: { time: number; [key: string]: number }): Promise<void>;
}
