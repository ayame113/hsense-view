import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.140.0/testing/asserts.ts";

import { TimeList } from "./list.ts";

Deno.test("TimeList", () => {
  const list = new TimeList();
  const { first, last } = list;
  assertEquals(first.done, true);
  assertEquals(first.value, undefined);
  assertEquals(last.done, true);
  assertEquals(last.value, undefined);
  // firstは左から数えて2番目、つまり最後のデータ
  // lastは右から数えて2番目、つまり最初のデータ
  assert(first.prev === last);
  assert(last.next === first);
});

Deno.test("TimeList addFirst", () => {
  const list = new TimeList<number>();
  list.addFirst(0);
  list.addFirst(1);
  list.addFirst(2);
  assertEquals([...TimeList.iterate(list.first)], [2, 1, 0]);
  assertEquals([...TimeList.iterate(list.last, "backward")], [0, 1, 2]);
});

Deno.test("TimeList addLast", () => {
  const list = new TimeList<number>();
  list.addLast(0);
  list.addLast(1);
  list.addLast(2);
  assertEquals([...TimeList.iterate(list.first)], [0, 1, 2]);
  assertEquals([...TimeList.iterate(list.last, "backward")], [2, 1, 0]);
});

Deno.test("TimeList addLast and addFirst", () => {
  const list = new TimeList<number>();
  list.addLast(0);
  list.addLast(1);
  list.addFirst(0);
  list.addFirst(1);
  assertEquals([...TimeList.iterate(list.first)], [1, 0, 0, 1]);
  assertEquals([...TimeList.iterate(list.last, "backward")], [1, 0, 0, 1]);
});

Deno.test("TimeList margeLast", () => {
  const list1 = new TimeList<number>();
  list1.addLast(0);
  list1.addLast(1);
  const list2 = new TimeList<number>();
  list2.addLast(2);
  list2.addLast(3);
  list1.margeLast(list2);
  assertEquals([...TimeList.iterate(list1.first)], [0, 1, 2, 3]);
  assertEquals([...TimeList.iterate(list1.last, "backward")], [3, 2, 1, 0]);
});

Deno.test("TimeList margeFirst", () => {
  const list1 = new TimeList<number>();
  list1.addLast(0);
  list1.addLast(1);
  const list2 = new TimeList<number>();
  list2.addLast(2);
  list2.addLast(3);
  list2.margeFirst(list1);
  assertEquals([...TimeList.iterate(list2.first)], [0, 1, 2, 3]);
  assertEquals([...TimeList.iterate(list2.last, "backward")], [3, 2, 1, 0]);
});
