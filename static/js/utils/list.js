class TimeListIterator {
  #current;
  #direction;
  constructor(start, direction = "forward") {
    this.#current = start;
    this.#direction = direction;
  }
  next() {
    const current = this.#current;
    // 必ず最後は{done: true}に到達することが保証されている
    // {done: false}の場合は次の要素に進める
    if (!current.done) {
      if (this.#direction === "forward") {
        this.#current = current.next;
      } else {
        this.#current = current.prev;
      }
    }
    return current;
  }
}
// 双方向リストの実装
// 先頭又は末尾への追加のみサポートしている
// FirstListElement, ListElement, ... , ListElement, LastListElementの順に連結
// FirstListElementとLastListElementは空のデータ（{done: true}）
// {done: boolean, value: T}を実装しているのでそのままイテレータにできる
export class TimeList {
  /**
   * TimeListをfor-of文で回す用
   * @param  start ループを開始する要素
   * @param  direction "forward"(デフォルト)の場合は前から後ろに、"backward"の場合は後ろから前に取り出す
   */ static iterate(start, direction = "forward") {
    return {
      [Symbol.iterator]() {
        return new TimeListIterator(start, direction);
      },
    };
  }
  #first;
  #last;
  #destroyed = false;
  constructor() {
    this.#first = {
      done: true,
      value: undefined,
      // @ts-expect-error: overwrite after
      next: null,
      prev: null,
    };
    this.#last = {
      done: true,
      value: undefined,
      next: null,
      // @ts-expect-error: overwrite after
      prev: null,
    };
    this.#first.next = this.#last;
    this.#last.prev = this.#first;
  }
  get first() {
    this.throwIfDestroyed();
    return this.#first.next;
  }
  get last() {
    this.throwIfDestroyed();
    return this.#last.prev;
  }
  get destroyed() {
    return this.#destroyed;
  }
  addFirst(value) {
    this.throwIfDestroyed();
    const { prev, newElement } = addData(this.#first, value, this.#first.next);
    this.#first = prev;
    return newElement;
  }
  addLast(value) {
    this.throwIfDestroyed();
    const { next, newElement } = addData(this.#last.prev, value, this.#last);
    this.#last = next;
    return newElement;
  }
  margeFirst(target) {
    this.throwIfDestroyed();
    // 結合する
    const leftLast = target.#last.prev;
    const rightFirst = this.#first.next;
    leftLast.next = rightFirst;
    rightFirst.prev = leftLast;
    // firstを変更
    this.#first = target.#first;
    // targetを破棄
    target.#destroyed = true;
  }
  margeLast(target) {
    this.throwIfDestroyed();
    // 結合する
    const leftLast = this.#last.prev;
    const rightFirst = target.#first.next;
    leftLast.next = rightFirst;
    rightFirst.prev = leftLast;
    // lastを変更
    this.#last = target.#last;
    // targetを破棄
    target.#destroyed = true;
  }
  /** デバッグ用 */ dump() {
    console.log("==dump==");
    let target = this.#first;
    for (let i = 0; i < 100; i++) {
      console.log({
        done: target.done,
        value: JSON.stringify(target.value),
      });
      if (!target.next) {
        console.log(`count: ${i}`);
        break;
      }
      target = target.next;
    }
    console.log("==dump end==");
  }
  throwIfDestroyed() {
    if (this.#destroyed) {
      throw new Error("cannot call destroyed list's method");
    }
  }
}
/** prevとnextの間にtargetを追加する */ function addData(prev, target, next) {
  const newElement = {
    done: false,
    value: target,
    next,
    prev,
  };
  prev.next = newElement;
  next.prev = newElement;
  return {
    prev,
    newElement,
    next,
  };
}
