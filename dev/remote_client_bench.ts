// リモート計測コード

import { delay } from "https://deno.land/std@0.144.0/async/delay.ts";

// const res = await fetch("https://socket-graph.deno.dev/api/create_token/koiwa");
// console.log(await res.json());

// websocketで送信するやつ
const id = "koiwa";
const TOKEN = "9ac57174-48b8-4a9b-bf44-905ac5a7d31b";
const socket = new WebSocket(`wss://socket-graph.deno.dev/ws/send/${id}`);
console.log("socket");

await new Promise((ok) => socket.addEventListener("open", ok));
console.log("socket2");

socket.send(TOKEN);

const wait = 1000;
for (let i = 0; i < 100; i++) {
  await delay(wait);
  const time = Date.now();
  const data = { time, i: 1 };
  socket.send(JSON.stringify(data));
  console.log(data);
}
