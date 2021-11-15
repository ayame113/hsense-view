import { serve, STATUS_TEXT } from "https://deno.land/std@0.114.0/http/mod.ts";
import { extname } from "https://deno.land/std@0.113.0/path/mod.ts";
import { contentType } from "https://deno.land/x/media_types@v2.10.2/mod.ts";
import { transform } from "https://deno.land/x/swc@0.1.4/mod.ts";

import "./listeners/mod.ts";
import { router, socketRouter } from "./listeners/router.ts";
import type { Extension, RouterResult } from "./listeners/router.ts";

function contentTypeFromPath(path: string) {
  return contentType(extname(path) ?? ".txt") ?? "text/plain; charset=utf-8";
}
function contentTypeFromExt(extension?: Extension) {
  return contentType(extension ?? ".txt") ?? "text/plain; charset=utf-8";
}

async function createResponse(src: RouterResult) {
  let { body, status, type } = await src;
  body ||= `${status} ${STATUS_TEXT.get(status ?? 200)}`;
  return new Response(body, {
    status,
    headers: { "Content-Type": contentTypeFromExt(type) },
  });
}

export function tsToJs(content: string) {
  return transform(content, {
    // minify: true,
    jsc: {
      target: "es2021",
      parser: {
        syntax: "typescript",
      },
    },
    // deno-lint-ignore no-explicit-any
  } as any).code;
}

async function handleHttpRequest(request: Request) {
  try {
    const url = new URL(request.url);
    if (request.method === "GET") {
      try {
        let { pathname } = url;
        if (pathname.at(-1) === "/") {
          pathname += "index.html";
        }
        console.log(
          await (await fetch(
            new URL(`./static${pathname}`, import.meta.url),
          )).text(),
        );

        const response = await fetch(
          new URL(`./static${pathname}`, import.meta.url),
        );
        try {
          if (extname(pathname) === ".ts") {
            return new Response(tsToJs(await response.text()), {
              headers: { "Content-Type": contentTypeFromExt(".js") },
            });
          } else {
            return new Response(response.body, {
              headers: { "Content-Type": contentTypeFromPath(pathname) },
            });
          }
        } catch (error) {
          console.log(error);
          return createResponse({ status: 500 });
        }
      } catch (error) {
        if (
          !(error instanceof TypeError ||
            error instanceof Deno.errors.PermissionDenied)
        ) {
          console.log(error);
          return createResponse({ status: 500 });
        }
      }
    }
    if (router[request.method as keyof typeof router]) {
      const routed = router[request.method as keyof typeof router].get(url);
      if (routed.handler) {
        if (!routed.match) {
          return createResponse(routed.handler({ request, url }));
        }
        return createResponse(
          routed.handler({ request, url, match: routed.match }),
        );
      }
    }
    return createResponse({ status: 404 });
  } catch (error) {
    console.log(error);
    return createResponse({ status: 500 });
  }
}

async function handleWebSocketRequst(request: Request) {
  try {
    const url = new URL(request.url);
    const { socket, response } = Deno.upgradeWebSocket(request);
    const routed = socketRouter.get(url);
    if (routed.handler) {
      if (!routed.match) {
        await routed.handler({ request, url, socket });
        return response;
      }
      await routed.handler({ request, url, socket, match: routed.match });
      return response;
    }
    return createResponse({ status: 404 });
  } catch (error) {
    console.log(error);
    return createResponse({ status: 500 });
  }
}

// export for test
export function startServer() {
  const controller = new AbortController();
  const server = serve((request) => {
    if (
      request.method === "GET" &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket" &&
      request.headers.get("Connection")?.toLowerCase() === "upgrade"
    ) {
      return handleWebSocketRequst(request);
    }
    return handleHttpRequest(request);
  }, controller);

  return { server, controller };
}

if (import.meta.main) {
  startServer();
}
