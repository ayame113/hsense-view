import { type ListElement, TimeList } from "../utils/list.ts";

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
    return super.margeFirst(target);
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
  #getFirstTime(defaultTime?: number) {
    if (this.#min.time != null) {
      return this.#min.time;
    }
    if (defaultTime != null) {
      return defaultTime;
    }
    throw new Error(
      "cant read firstTime of empty list without specify default value",
    );
  }
  #getLastTime(defaultTime?: number) {
    if (this.#max.time != null) {
      return this.#max.time;
    }
    if (defaultTime != null) {
      return defaultTime;
    }
    throw new Error(
      "cant read lastTime of empty list without specify default value",
    );
  }
  async requestData(to: number | null, from: number) {
    const result = await this.#requestOldData(from);
    let oldestTime = null;
    for (const data of result) {
      if (to !== null && data.time < to) {
        break;
      }
      oldestTime = data.time;
      this.addFirst(data);
    }
    if (to !== null && oldestTime && to < oldestTime) {
      this.requestData(to, oldestTime);
    }
  }
  *iterateData(from: number, to: number) {
  }

  #loadingPromise?: Promise<void>;
  async requestLoadFirstData() {
    const dataList = await this.#requestOldData();
    for (const data of reversed(dataList)) {
      //最近の物から順にaddしていく
      this.addFirst(data);
    }
  }
  async requestLoadData(requestEndTime: number, origin?: number) {
    // 重複ロードを防止
    this.#loadingPromise = (async () => {
      await this.#loadingPromise?.catch();
      await this.#requestLoadDataInner(requestEndTime, origin);
    })();
    await this.#loadingPromise;
  }
  async #requestLoadDataInner(requestEndTime: number, origin?: number) {
    this.throwIfDestroyed();
    const firstTime = this.#getFirstTime(origin);
    const lastTime = this.#getLastTime(origin);
    if (requestEndTime < firstTime) {
      // firstTimeより前のデータを読み込み
      let requestTime = firstTime;
      while (true) {
        // dataListは古い順
        const dataList = await this.#requestOldData(requestTime);
        if (!dataList.length) {
          break;
        }
        for (const data of reversed(dataList)) {
          //最近の物から順にaddしていく
          this.addFirst(data);
        }
        if (dataList[0].time < requestEndTime) {
          break;
        }
        requestTime = dataList[0].time;
      }
    } else if (lastTime < requestEndTime) {
      // lastTimeより後のデータを読み込み
      let requestTime = requestEndTime;
      const afterList = new DataList({ requestOldData: this.#requestOldData });
      loop:
      while (true) {
        const dataList = await this.#requestOldData(requestTime);
        // dataListは古い順
        if (!dataList.length) {
          break;
        }
        for (const data of reversed(dataList)) {
          if (data.time <= lastTime) {
            break loop;
          }
          afterList.addFirst(data);
        }
        requestTime = dataList[0].time;
      }
      this.margeLast(afterList);
    }
  }
  *iterate(from: number, to: number, searchOrigin?: ListElement<TimeData>) {
    let fromElement = searchOrigin ?? this.first;
    if (fromElement.done) {
      return;
    }
    while (fromElement.value.time < from) {
      if (fromElement.prev.done) {
        break;
      }
      fromElement = fromElement.prev;
    }
    while (to < fromElement.value.time) {
      yield fromElement;
      if (fromElement.next.done) {
        break;
      }
      fromElement = fromElement.next;
    }
  }
}

function reversed<T>(array: T[]): Iterable<T> {
  return {
    [Symbol.iterator]() {
      let i = array.length;
      return {
        next() {
          if (i <= 0) {
            return {
              done: true,
              value: undefined,
            };
          }
          return {
            done: false,
            value: array[--i],
          };
        },
      };
    },
  };
}
