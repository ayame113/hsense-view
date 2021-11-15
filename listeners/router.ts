import type { Status } from "https://deno.land/std@0.114.0/http/mod.ts";
import { Router } from "../static/utils/router.ts";

type PromiseOrValue<T> = T | Promise<T>;

export type Extension = `.${string}`;
type RouterArg = {
  StringHandlerArg: {
    request: Readonly<Request>;
    url: Readonly<URL>;
  };
  PatternHandlerArg: {
    request: Readonly<Request>;
    url: Readonly<URL>;
    match: URLPatternResult;
  };
};
export type RouterResult = PromiseOrValue<
  {
    body: BodyInit;
    status?: Status;
    type?: Extension;
  } | {
    body?: BodyInit;
    status: Status;
    type?: Extension;
  }
>;

type WebSocketRouterArg = {
  StringHandlerArg: {
    request: Readonly<Request>;
    url: Readonly<URL>;
    socket: WebSocket;
  };
  PatternHandlerArg: {
    request: Readonly<Request>;
    url: Readonly<URL>;
    socket: WebSocket;
    match: URLPatternResult;
  };
};

export const router = {
  GET: new Router<RouterArg, RouterResult>(),
  POST: new Router<RouterArg, RouterResult>(),
};

export const socketRouter = new Router<
  WebSocketRouterArg,
  PromiseOrValue<void>
>();
