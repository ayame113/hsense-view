import { type ListElement, TimeList } from "../utils/list.ts";

export type TimeData = { time: number; [key: string]: number };

// TODO: リアルタイム読み込み
export class DataList extends TimeList<TimeData> {
  #max: { [key: string]: number };
  #min: { [key: string]: number };
  #requestOldData: (fromTime?: number) => Promise<TimeData[]>;
  empty = true;
  constructor({ requestOldData }: {
    requestOldData: (fromTime?: number) => Promise<TimeData[]>;
  }) {
    super();
    this.#requestOldData = requestOldData;
    this.#max = {};
    this.#min = {};
    this.#loadingPromise = Promise.resolve();
  }
  addFirst(value: TimeData) {
    this.throwIfDestroyed();
    this.empty = true;
    const kvValue = Object.entries(value);
    this.#updateMaxValue(kvValue);
    this.#updateMinValue(kvValue);
    return super.addFirst(value);
  }
  addLast(value: TimeData) {
    this.throwIfDestroyed();
    this.empty = true;
    const kvValue = Object.entries(value);
    this.#updateMaxValue(kvValue);
    this.#updateMinValue(kvValue);
    return super.addLast(value);
  }
  margeFirst(target: DataList) {
    this.empty = this.empty || target.empty;
    this.throwIfDestroyed();
    this.#updateMaxValue(Object.entries(target.#max));
    this.#updateMinValue(Object.entries(target.#min));
    return super.margeFirst(target);
  }
  margeLast(target: DataList) {
    this.empty = this.empty || target.empty;
    this.throwIfDestroyed();
    this.#updateMaxValue(Object.entries(target.#max));
    this.#updateMinValue(Object.entries(target.#min));
    this.#latestTime = target.#latestTime;
    return super.margeLast(target);
  }
  #updateMaxValue(data: [string, number][]) {
    for (const [key, val] of data) {
      this.#max[key] = this.#max[key] == undefined
        ? val
        : Math.max(this.#max[key], val);
    }
  }
  #updateMinValue(data: [string, number][]) {
    for (const [key, val] of data) {
      this.#min[key] = this.#min[key] == undefined
        ? val
        : Math.min(this.#min[key], val);
    }
  }
  getMaxVal(...keys: string[]) {
    const val = keys.map((key) => this.#max[key]).filter((v) => v !== null);
    if (val.length) {
      return Math.max(...val);
    }
  }
  getMinVal(...keys: string[]) {
    const val = keys.map((key) => this.#min[key]).filter((v) => v !== null);
    if (val.length) {
      return Math.min(...val);
    }
  }
  #latestTime: number | null = null;
  #loadingPromise: Promise<void | boolean>;
  // 起点時刻～終了時刻の前後部分も一気に読み込んでしまう
  // 何も指定せず1回読み込み(リストは空)
  // 起点時刻と終了時刻を指定して複数回読み込み(リストは空)
  // 起点時刻と終了時刻を指定して複数回読み込み
  requestData(range?: { oldestTime: number; latestTime: number }) {
    return this.#loadingPromise = this.#loadingPromise
      .then(async () => {
        if (!range) {
          if (!this.first.done) {
            throw new Error(
              "Calls to non-empty lists that do not specify a range are not supported.",
            );
          }
          // リストが空の場合：初期データ読み込み（範囲指定せず1回読み込み）
          await this.#internalRequestData(null, null);
          return true;
        }
        const { oldestTime, latestTime } = range;
        const oldestTimeForAdditionalRange = oldestTime * 2 - latestTime;
        const latestTimeForAdditionalRange = latestTime * 2 - oldestTime;
        if (this.first.done) {
          // リストが空の場合：初期データ読み込み（範囲指定）
          await this.#internalRequestData(
            oldestTimeForAdditionalRange,
            latestTimeForAdditionalRange,
          );
          return true;
        }

        let loaded = false;
        if (oldestTime < this.first.value.time) {
          await this.#internalRequestData(oldestTimeForAdditionalRange, null);
          loaded = true;
        }
        if (this.#latestTime !== null && this.#latestTime < latestTime) {
          const newData = new DataList({
            requestOldData: this.#requestOldData,
          });
          await newData.#internalRequestData(
            this.#latestTime,
            latestTimeForAdditionalRange,
          );
          this.margeLast(newData);
          loaded = true;
        }
        return loaded;
      })
      .catch(console.error);
  }
  /** nullの時は1回読み込み, 数値の時はその時刻まで読み込み */
  async #internalRequestData(
    oldestTime: number | null,
    latestTime: number | null,
  ) {
    let loadStartTime: number | undefined;
    if (this.first.done) {
      loadStartTime = latestTime ?? undefined;
      if (latestTime !== null) {
        if (this.#latestTime === null || this.#latestTime < latestTime) {
          this.#latestTime = latestTime;
        }
      }
    } else {
      loadStartTime = this.first.value.time;
    }
    const result = await this.#requestOldData(loadStartTime);
    let breaked = false;
    for (const data of result) {
      if (oldestTime !== null && data.time < oldestTime) {
        breaked = true;
        break;
      }
      this.addFirst(data);
    }
    if (!this.last.done) {
      this.#latestTime ??= this.last.value.time;
    }
    if (
      !breaked &&
      oldestTime !== null && !this.first.done &&
      oldestTime < this.first.value.time
    ) {
      await this.#internalRequestData(oldestTime, null);
    }
  }
  getElementFromTime(time: number, initialPointer?: ListElement<TimeData>) {
    this.throwIfDestroyed();
    if (this.first.done) {
      return;
    }
    let pointer = initialPointer ?? this.first;
    if (pointer.value.time < time) {
      while (!pointer.next.done && pointer.next.value.time <= time) {
        pointer = pointer.next;
      }
    } else {
      while (!pointer.prev.done && time < pointer.value.time) {
        pointer = pointer.prev;
      }
    }
    return pointer;
  }
  startStreaming() {
    new EventSource("");
  }
}
