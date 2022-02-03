import { TimeList } from "../utils/list.js";
export class DataList extends TimeList {
  #max;
  #min;
  #requestOldData;
  #getEventSource;
  #onUpdateFunc;
  #onUpdateKeyFunc;
  #keys;
  constructor({ requestOldData, getEventSource }) {
    super();
    this.empty = true;
    this.#requestOldData = requestOldData;
    this.#getEventSource = getEventSource;
    this.#max = {};
    this.#min = {};
    this.#loadingPromise = Promise.resolve();
    this.#onUpdateFunc = new Set();
    this.#onUpdateKeyFunc = new Set();
    this.#keys = new Set([
      "time",
    ]); // timeは元から存在
  }
  addFirst(value) {
    this.throwIfDestroyed();
    this.empty = true;
    const kvValue = Object.entries(value);
    this.#updateMaxValue(kvValue);
    this.#updateMinValue(kvValue);
    this.#updateKey(kvValue);
    const res = super.addFirst(value);
    for (const fn of this.#onUpdateFunc) {
      fn();
    }
    return res;
  }
  addLast(value) {
    this.throwIfDestroyed();
    this.empty = true;
    const kvValue = Object.entries(value);
    this.#updateMaxValue(kvValue);
    this.#updateMinValue(kvValue);
    this.#updateKey(kvValue);
    const res = super.addLast(value);
    for (const fn of this.#onUpdateFunc) {
      fn();
    }
    return res;
  }
  margeFirst(target) {
    this.empty = this.empty || target.empty;
    this.throwIfDestroyed();
    this.#updateMaxValue(Object.entries(target.#max));
    this.#updateMinValue(Object.entries(target.#min));
    this.#updateKey(Object.entries(target.#min));
    super.margeFirst(target);
    for (const fn of this.#onUpdateFunc) {
      fn();
    }
  }
  margeLast(target) {
    this.empty = this.empty || target.empty;
    this.throwIfDestroyed();
    this.#updateMaxValue(Object.entries(target.#max));
    this.#updateMinValue(Object.entries(target.#min));
    this.#updateKey(Object.entries(target.#min));
    this.#latestTime = target.#latestTime && this.#latestTime
      ? Math.max(target.#latestTime, this.#latestTime)
      : target.#latestTime ?? this.#latestTime;
    super.margeLast(target);
    for (const fn of this.#onUpdateFunc) {
      fn();
    }
  }
  #updateMaxValue(data) {
    for (const [key, val] of data) {
      this.#max[key] = this.#max[key] == undefined
        ? val
        : Math.max(this.#max[key], val);
    }
  }
  #updateMinValue(data) {
    for (const [key, val] of data) {
      this.#min[key] = this.#min[key] == undefined
        ? val
        : Math.min(this.#min[key], val);
    }
  }
  #updateKey(data) {
    for (const [key] of data) {
      if (!this.#keys.has(key)) {
        this.#keys.add(key);
        for (const fn of this.#onUpdateKeyFunc) {
          fn(key);
        }
      }
    }
  }
  getMaxVal(...keys) {
    const val = keys.map((key) => this.#max[key]).filter((v) => v !== null);
    if (val.length) {
      return Math.max(...val);
    }
  }
  getMinVal(...keys) {
    const val = keys.map((key) => this.#min[key]).filter((v) => v !== null);
    if (val.length) {
      return Math.min(...val);
    }
  }
  /** この時刻より前のデータの読み込みは完了している */ #latestTime = null;
  /** この時刻より前にデータは存在しないので、読み込む必要はない */ #oldestTime = null;
  #loadingPromise;
  // 起点時刻～終了時刻の前後部分も一気に読み込んでしまう
  // 何も指定せず1回読み込み(リストは空)
  // 起点時刻と終了時刻を指定して複数回読み込み(リストは空)
  // 起点時刻と終了時刻を指定して複数回読み込み
  requestData(range, { allowAdditionalRange = true } = {}) {
    return this.#loadingPromise = this.#loadingPromise.then(async () => {
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
      const oldestTimeForAdditionalRange = allowAdditionalRange
        ? oldestTime * 2 - latestTime
        : oldestTime;
      const latestTimeForAdditionalRange = allowAdditionalRange
        ? latestTime * 2 - oldestTime
        : latestTime;
      if (this.first.done) {
        if (this.#latestTime === Infinity) {
          return;
        }
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
          getEventSource: this.#getEventSource,
        });
        await newData.#internalRequestData(
          this.#latestTime,
          latestTimeForAdditionalRange,
          true,
        );
        this.margeLast(newData);
        loaded = true;
      }
      return loaded;
    }).catch(console.error);
  }
  /** nullの時は1回読み込み, 数値の時はその時刻まで読み込み */ async #internalRequestData(
    oldestTime,
    latestTime,
    stopLoadingIfOldestTime = false,
  ) {
    // 古い側のデータを読み込んでリストの前に繋げていく
    let loadStartTime;
    if (this.first.done) {
      loadStartTime = latestTime ?? undefined;
      if (latestTime !== null) {
        if (this.#latestTime === null || this.#latestTime < latestTime) {
          this.#latestTime = Math.min(latestTime, Date.now());
        }
      }
    } else {
      loadStartTime = this.first.value.time;
    }
    if (
      loadStartTime && this.#oldestTime && loadStartTime <= this.#oldestTime
    ) {
      // this.#oldestTimeより古い時刻を読み込んでも何も返ってこない
      return;
    }
    const result = await this.#requestOldData(loadStartTime);
    if (result.length === 0) {
      this.#oldestTime = this.#oldestTime == null
        ? loadStartTime ?? null
        : Math.max(loadStartTime ?? Date.now(), this.#oldestTime);
      return;
    }
    let breaked = false;
    for (const data of result) {
      if (
        stopLoadingIfOldestTime && oldestTime !== null && data.time < oldestTime
      ) {
        breaked = true;
        break;
      }
      this.addFirst(data);
    }
    if (!this.last.done) {
      this.#latestTime ??= this.last.value.time;
    }
    if (
      !breaked && oldestTime !== null && !this.first.done &&
      oldestTime < this.first.value.time
    ) {
      await this.#internalRequestData(
        oldestTime,
        null,
        stopLoadingIfOldestTime,
      );
    }
  }
  getElementFromTime(time, initialPointer) {
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
  #eventSource;
  startStreaming() {
    if (!this.#eventSource) {
      this.#eventSource = this.#getEventSource();
      const loadLatestData = new Promise((ok) => {
        // openした時点までのデータを取得して追加する
        this.#eventSource?.addEventListener("open", async () => {
          if (this.last.value) {
            await this.requestData({
              oldestTime: this.last.value.time,
              latestTime: Date.now(),
            }, {
              allowAdditionalRange: false,
            });
          } else {
            await this.requestData();
          }
          this.#latestTime = Infinity;
          ok(); // ^_^
        });
      }).catch(console.error);
      this.#eventSource.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        loadLatestData.then(() => {
          this.addLast(data);
        });
      });
    }
  }
  stopStreaming() {
    this.#eventSource?.close();
    this.#eventSource = undefined;
    this.#latestTime = Date.now();
  }
  onUpdate(fn, { signal } = {}) {
    if (signal?.aborted) {
      return;
    }
    signal?.addEventListener("abort", () => this.#onUpdateFunc.delete(fn));
    this.#onUpdateFunc.add(fn);
  }
  onKeyUpdate(fn, { signal } = {}) {
    if (signal?.aborted) {
      return;
    }
    signal?.addEventListener("abort", () => this.#onUpdateKeyFunc.delete(fn));
    this.#onUpdateKeyFunc.add(fn);
  }
}
