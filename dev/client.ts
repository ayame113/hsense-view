import { delay } from "https://deno.land/std@0.141.0/async/mod.ts";

// websocketで送信するやつ
const id = "sakura";
const TOKEN = "d44e1576-491a-4adb-8306-e049561a30a7";
const socket = new WebSocket(`ws://localhost:8000/ws/send/${id}`);

await new Promise((ok) => socket.addEventListener("open", ok));

socket.send(TOKEN);

const wait = 2000;
while (true) {
  await delay(wait);
  const time = Date.now();
  const data = {
    time,
    i: Math.sin(time / (wait * 5)),
    i2: Math.sin(time / (wait * 5) + Math.PI * 2 / 3),
    i3: Math.sin(time / (wait * 5) + Math.PI * 4 / 3),
  };
  console.log(data);
  socket.send(JSON.stringify(data));
}
