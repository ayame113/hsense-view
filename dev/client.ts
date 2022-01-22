import { delay } from "https://deno.land/std@0.122.0/async/mod.ts";

// websocketで送信するやつ
const id = "sakura";
const TOKEN = "d44e1576-491a-4adb-8306-e049561a30a7";
const socket = new WebSocket(`ws://localhost:8000/ws/send/${id}`);

await new Promise((ok) => socket.addEventListener("open", ok));

socket.send(TOKEN);

while (true) {
  await delay(5000);
  const data = { time: Date.now(), i: Math.sin(Date.now()) };
  console.log(data);
  socket.send(JSON.stringify(data));
}
