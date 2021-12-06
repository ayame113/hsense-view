import { router } from "../router.ts";

const encoder = new TextEncoder();

router.GET.set(
  new URLPattern({ pathname: "/sse/data/:id" }),
  ({ match: { pathname: { groups: { id } } } }) => {
    let channel: BroadcastChannel | undefined;
    const body = new ReadableStream({
      start(controller) {
        channel = new BroadcastChannel(`data.${id}`);
        channel.addEventListener("message", (event) => {
          const data = encoder.encode(
            `data: ${event.data.split("\n").join("\ndata: ")}\n\n`,
          );
          controller.enqueue(data);
        });
      },
      cancel() {
        channel?.close();
      },
    });
    return { body, contentType: "text/event-stream; charset=utf-8" };
  },
);
