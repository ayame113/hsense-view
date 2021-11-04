// Using dotenv only for local development.
// For deno deploy, using built-in environment variable support.
import "https://deno.land/x/dotenv@v3.1.0/load.ts";

interface Listener {
  pattern: URLPattern;
  handler: (
    { request, url, pattern }: {
      request: Readonly<Request>;
      url: Readonly<URL>;
      pattern: URLPatternResult;
    },
  ) => Response | Promise<Response>;
}

export const listeners: Listener[] = [
  {
    pattern: new URLPattern({ pathname: "/" }),
    handler: async ({ request, url, pattern }) => {
      console.log(request, url, pattern.pathname);
      return new Response(
        await Deno.readFile(new URL("./static/index.html", import.meta.url)),
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      );
    },
  },
  {
    pattern: new URLPattern({ pathname: "/ws/date" }),
    handler: ({ request, url, pattern }) => {
      const { socket, response } = Deno.upgradeWebSocket(request);
      const intervalId = setInterval(() => {
        socket.send(`${Date.now()}`);
      }, 1000);
      socket.addEventListener("close", () => {
        console.log(`closed`);
        clearInterval(intervalId);
      });
      socket.addEventListener("error", () => {
        console.log(`error`);
        clearInterval(intervalId);
      });
      return response;
    },
  },
];
