class Iter {
  #src;
  constructor(src) {
    this.#src = src;
  }
  /**
   * mapping iterator
   * ```ts
   * iter([0, 1, 2]).map((i)=>i ** 2).forEach(console.log) //=> 0, 1, 4
   * ```
   */ map(fn) {
    return new Iter(map(this.#src, fn));
  }
  /**
   * Iterates while returning true from `fn`
   * ```ts
   * iter([0, 1, 2]).takeWhile((i)=>i < 2).forEach(console.log) //=> 0, 1
   * ```
   */ takeWhile(fn) {
    return new Iter(takeWhile(this.#src, fn));
  }
  /**
   * filtering data
   * ```ts
   * iter([0, 1, 2]).filter((i)=>i % 2).forEach(console.log) //=> 1
   * ```
   */ filter(fn) {
    return new Iter(filter(this.#src, fn));
  }
  /**
   * consume iterator
   * ```ts
   * iter([0, 1, 2]).forEach(console.log) //=> 0, 1, 2
   * ```
   */ forEach(fn) {
    for (const val of this.#src) {
      fn(val);
    }
    return this;
  }
  /**
   * convert to Array
   * ```ts
   * iter([0, 1, 2]).toArray() //=> [0, 1, 2]
   * ```
   */ toArray() {
    return [
      ...this.#src,
    ];
  }
  /**
   * consume iterator
   * ```ts
   * for (const val of iter([0, 1, 2])) {
   *   console.log(val);
   * }
   * ```
   */ [Symbol.iterator]() {
        return this.#src[Symbol.iterator]();
    }
}
/**
 * create iterator helper
 * ```ts
 * iter([0, 1, 2]).map((i)=>i**2).forEach(console.log) //=> 0, 1, 4
 * ```
 * ```ts
 * for (const val of iter([0, 1, 2])) {
 *   console.log(val);
 * }
 * ```
 */ export function iter(src) {
    return new Iter(src);
}
function map(src, fn) {
  return {
    *[Symbol.iterator]() {
      for (const val of src) {
        yield fn(val);
      }
    },
  };
}
function takeWhile(src, fn) {
    return {
        *[Symbol.iterator] () {
            for (const val of src){
                if (!fn(val)) {
                    break;
                }
                yield val;
            }
        }
    };
}
function filter(src, fn) {
    return {
        *[Symbol.iterator] () {
            for (const val of src){
                if (!fn(val)) {
                    continue;
                }
                yield val;
            }
        }
    };
}
