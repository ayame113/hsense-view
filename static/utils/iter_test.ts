import { assertEquals } from "https://deno.land/std@0.122.0/testing/asserts.ts";
import { iter } from "./iter.ts";

Deno.test("iter[Symbol.iterator]", () => {
  const i = iter([0, 1, 2]);
  assertEquals([...i], [0, 1, 2]);
  assertEquals([...i], [0, 1, 2]);
});

Deno.test("iter.forEach", () => {
  const result1: number[] = [];
  const result2: number[] = [];
  iter([0, 1, 2])
    .forEach((i) => result1.push(i))
    .forEach((i) => result2.push(i));
  assertEquals(result1, [0, 1, 2]);
  assertEquals(result2, [0, 1, 2]);
});

Deno.test("iter.map", () => {
  const i = iter([0, 1, 2]).map((i) => i ** 2);
  assertEquals([...i], [0, 1, 4]);
  assertEquals([...i], [0, 1, 4]);
  assertEquals([...i.map((i) => i ** 2)], [0, 1, 16]);
});

Deno.test("iter.takeWhile", () => {
  const i = iter([0, 1, 2, 3]).takeWhile((i) => i != 2);
  assertEquals([...i], [0, 1]);
  assertEquals([...i], [0, 1]);
  assertEquals([...i.map((i) => i ** 2)], [0, 1]);
});

Deno.test("iter.filter", () => {
  const i = iter([0, 1, 2, 3]).filter((i) => !(i % 2));
  assertEquals([...i], [0, 2]);
  assertEquals([...i], [0, 2]);
  assertEquals([...i.filter((i) => !!(i % 2))], []);
});

Deno.test("iter.toArray", () => {
  const i = iter([0, 1, 2]).map((i) => i ** 2);
  assertEquals(i.toArray(), [0, 1, 4]);
  assertEquals(i.toArray(), [0, 1, 4]);
});
