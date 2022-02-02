// 計測用コード

import { EventSource } from "https://deno.land/x/eventsource@v0.0.2/mod.ts";

const source = new EventSource("https://socket-graph.deno.dev/sse/data/koiwa");
source.addEventListener("message", (e) => {
  const event = e as MessageEvent;
  const sendTime = JSON.parse(event.data);
  console.log(event.timeStamp - sendTime.time);
});
