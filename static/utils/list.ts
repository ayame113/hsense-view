export class TimeList<T> {
  #data: Record<string, T>;
  constructor() {
    this.#data = {};
  }
}
