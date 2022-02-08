import { delay } from "https://deno.land/std@0.125.0/async/mod.ts";

// const api = "ws://localhost:8000";
const api = "wss://socket-graph.deno.dev";

// websocketで送信するやつ
const id = "水道メーター1";
const TOKEN = "d09d3670-6e08-45cf-935d-cf6cc30a3d5a";
const socket = new WebSocket(`${api}/ws/send/${id}`);
socket.addEventListener("close", console.log);

await new Promise((ok) => socket.addEventListener("open", ok));

socket.send(TOKEN);

const wait = 2000;
while (true) {
  await delay(wait);
  const time = Date.now();
  const data = {
    time,
    "流速（m^3／h）": 0.5 + Math.random() * 0.1,
  };
  console.log(data);
  socket.send(JSON.stringify(data));
}
