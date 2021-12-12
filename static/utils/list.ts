export class TimeList<T> {
  #data: Record<string, T>;
  constructor(parameters) {
    this.#data = {};
  }
}
