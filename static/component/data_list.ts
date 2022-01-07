import {
  type LastListElement,
  type ListElement,
  TimeList,
} from "../utils/list.ts";

export type TimeData = { time: number; [key: string]: number };

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
  #loadingPromise: Promise<void>;
  // 何も指定せず1回読み込み(リストは空)
  // 起点時刻と終了時刻を指定して複数回読み込み(リストは空)
  // 起点時刻と終了時刻を指定して複数回読み込み
  requestData(range?: { oldestTime: number; latestTime: number }) {
    return this.#loadingPromise = this.#loadingPromise.catch(console.error)
      .then(async () => {
        if (!range) {
          if (!this.first.done) {
            throw "!!!!!!!";
          }
          return await this.#internalRequestData(null, null);
        }
        const { oldestTime, latestTime } = range;
        if (this.first.done) {
          return await this.#internalRequestData(oldestTime, latestTime);
        }

        if (oldestTime < this.first.value.time) {
          await this.#internalRequestData(oldestTime, null);
        }
        if (this.#latestTime !== null && this.#latestTime < latestTime) {
          const newData = new DataList({
            requestOldData: this.#requestOldData,
          });
          await newData.#internalRequestData(this.#latestTime, latestTime);
          this.margeLast(newData);
        }
      });
  }
  /** nullの時は1回読み込み, 数値の時はその時刻まで読み込み */
  async #internalRequestData(
    oldestTime: number | null,
    latestTime: number | null,
  ) {
    console.log("internalRequestData: ", { oldestTime, latestTime });
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
    for (const data of result) {
      if (oldestTime !== null && data.time < oldestTime) {
        break;
      }
      this.addFirst(data);
    }
    if (!this.last.done) {
      this.#latestTime ??= this.last.value.time;
    }
    if (
      oldestTime !== null && !this.first.done &&
      oldestTime < this.first.value.time
    ) {
      await this.#internalRequestData(oldestTime, null);
    }
  }
  #internalPointer?: ListElement<TimeData>;
  *iterateData(oldestTime: number, latestTime: number) {
    if (this.first.done) {
      return;
    }
    this.#internalPointer ??= this.first;
    if (this.#internalPointer.value.time < oldestTime) {
      while (
        !this.#internalPointer.next.done &&
        oldestTime < this.#internalPointer.value.time
      ) {
        this.#internalPointer = this.#internalPointer.next;
      }
    } else {
      while (
        !this.#internalPointer.prev.done &&
        this.#internalPointer.value.time < oldestTime
      ) {
        this.#internalPointer = this.#internalPointer.prev;
      }
    }
    let currentElement: ListElement<TimeData> | LastListElement<TimeData> =
      this.#internalPointer;
    while (!currentElement.done && currentElement.value.time < latestTime) {
      yield currentElement.value;
      currentElement = currentElement.next;
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
}

const l = new DataList({
  requestOldData(time) {
    time ??= Date.now();
    return Promise.resolve([
      { time: time - 1 },
      { time: time - 2 },
      { time: time - 3 },
      { time: time - 4 },
      { time: time - 5 },
    ]);
  },
});
/*
await l.requestData();
await l.requestData({
  oldestTime: Date.now() - 10,
  latestTime: Date.now() + 5,
});

console.log("result:");
l.dump();
*/

for (let time = 0; time < 10; time++) {
  l.addLast({ time });
}
l.dump();
const p4 = l.getElementFromTime(4);
console.log(p4?.value);
const p2 = l.getElementFromTime(2, p4);
console.log(p2?.value);
