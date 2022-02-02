// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.123.0/testing/asserts.ts";

import { mockFn } from "../../static/utils/test_mock.ts";
import { router } from "../router.ts";
import { database } from "../../db/mod.ts";
import "./db.ts";

const resolved: {
  <T>(v: T): (() => Promise<T>);
  (): (() => Promise<void>);
} = <T>(v?: T) => () => Promise.resolve(v);
const rejected = <T>(v?: T) => () => Promise.reject(v);

Deno.test(
  "/api/create_token/:id - success",
  async () => {
    const mock = mockFn(database, "createToken", resolved("[API test]"));
    const { handler, match } = router.GET.get({
      pathname: "/api/create_token/apple",
    });
    const result = await handler!({ match } as any);
    assertEquals(mock.calls[0][0], "apple");
    assertEquals(result.body, '{"success":true,"token":"[API test]"}');
    assertEquals(result.type, ".json");
    mock.release();
  },
);

Deno.test(
  "/api/create_token/:id - fail",
  async () => {
    const mock = mockFn(database, "createToken", resolved(null));
    const { handler, match } = router.GET.get({
      pathname: "/api/create_token/apple",
    });
    const result = await handler!({ match } as any);
    assertEquals(mock.calls[0][0], "apple");
    assertEquals(result.body, '{"success":false,"token":null}');
    assertEquals(result.type, ".json");
    mock.release();
  },
);

Deno.test(
  "/api/create_token/:id - throw",
  async () => {
    const mock = mockFn(database, "createToken", rejected("throw for test"));
    const { handler, match } = router.GET.get({
      pathname: "/api/create_token/apple",
    });
    const result = await handler!({ match } as any);
    assertEquals(mock.calls[0][0], "apple");
    assertEquals(result.body, '{"success":false,"token":null}');
    assertEquals(result.type, ".json");
    mock.release();
  },
);

Deno.test(
  "/api/data/:id - limit/fromTime - success",
  async () => {
    const mock = mockFn(database, "getDataByLimit", resolved([{ time: 0 }]));
    const { handler, match } = router.GET.get({
      pathname: "/api/data/apple",
    });
    const url = { searchParams: new URLSearchParams("limit=5&fromTime=10") };
    const result = await handler!({ match, url } as any);
    assertEquals(mock.calls[0][0], "apple");
    assertEquals(mock.calls[0][1], { fromTime: 10, limit: 5 });
    assertEquals(result.body, '{"success":true,"data":[{"time":0}]}');
    assertEquals(result.type, ".json");
    mock.release();
  },
);

Deno.test(
  "/api/data/:id - limit - success",
  async () => {
    const mock = mockFn(database, "getDataByLimit", resolved([{ time: 0 }]));
    const { handler, match } = router.GET.get({
      pathname: "/api/data/apple",
    });
    const url = { searchParams: new URLSearchParams("limit=5") };
    const result = await handler!({ match, url } as any);
    assertEquals(mock.calls[0][0], "apple");
    assertEquals(mock.calls[0][1], { fromTime: void 0, limit: 5 });
    assertEquals(result.body, '{"success":true,"data":[{"time":0}]}');
    assertEquals(result.type, ".json");
    mock.release();
  },
);

Deno.test(
  "/api/data/:id - fromTime - success",
  async () => {
    const mock = mockFn(database, "getDataByLimit", resolved([{ time: 0 }]));
    const { handler, match } = router.GET.get({
      pathname: "/api/data/apple",
    });
    const url = { searchParams: new URLSearchParams("fromTime=10") };
    const result = await handler!({ match, url } as any);
    assertEquals(mock.calls[0][0], "apple");
    assertEquals(mock.calls[0][1], { fromTime: 10, limit: void 0 });
    assertEquals(result.body, '{"success":true,"data":[{"time":0}]}');
    assertEquals(result.type, ".json");
    mock.release();
  },
);

Deno.test(
  "/api/data/:id - fail",
  async () => {
    const mock = mockFn(database, "getDataByLimit", rejected("throw for test"));
    const { handler, match } = router.GET.get({
      pathname: "/api/data/apple",
    });
    const url = { searchParams: new URLSearchParams("limit=5&fromTime=10") };
    const result = await handler!({ match, url } as any);
    assertEquals(mock.calls[0][0], "apple");
    assertEquals(mock.calls[0][1], { fromTime: 10, limit: 5 });
    assertEquals(result.body, '{"success":false,"data":null}');
    assertEquals(result.type, ".json");
    mock.release();
  },
);

Deno.test(
  "/api/delete_old_data - success",
  async () => {
    const mock = mockFn(database, "deleteDataByTime", resolved());
    const dateMock = mockFn(Date, "now", () => 500 + 7 * 24 * 60 * 60 * 1000);
    const { handler, match } = router.DELETE.get({
      pathname: "/api/delete_old_data",
    });
    const result = await handler!({ match } as any);
    assertEquals(mock.calls[0][0], 500);
    assertEquals(result.body, '{"success":true}');
    assertEquals(result.type, ".json");
    mock.release();
    dateMock.release();
  },
);

Deno.test(
  "/api/delete_old_data - fail",
  async () => {
    const mock = mockFn(
      database,
      "deleteDataByTime",
      rejected("throw for test"),
    );
    const dateMock = mockFn(Date, "now", () => 500 + 7 * 24 * 60 * 60 * 1000);
    const { handler, match } = router.DELETE.get({
      pathname: "/api/delete_old_data",
    });
    const result = await handler!({ match } as any);
    assertEquals(mock.calls[0][0], 500);
    assertEquals(result.body, '{"success":false}');
    assertEquals(result.type, ".json");
    mock.release();
    dateMock.release();
  },
);
