import { delay } from "https://deno.land/std@0.125.0/async/mod.ts";

// TODO:
// closeしたときに再接続

// const api = "ws://localhost:8000";
const api = "wss://socket-graph.deno.dev";

// websocketで送信するやつ
const id = "水道メーター1";
const TOKEN = "d09d3670-6e08-45cf-935d-cf6cc30a3d5a";
const socktURL = `${api}/ws/send/${id}`;

let 流量 = 0;

while (true) {
  // 無限に再接続処理
  try {
    const socket = new WebSocket(socktURL);

    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve);
      socket.addEventListener("close", reject);
    });

    socket.send(TOKEN);

    const wait = 2000;
    while (true) {
      await delay(wait);
      const time = Date.now();
      const 流速 = 0.5 + Math.random() * 0.1;
      流量 += 流速;
      const data = {
        time,
        "流速（m^3）": 流速,
        "流量（m^3／h）": 流量,
      };
      console.log(data);
      socket.send(JSON.stringify(data));
    }
  } catch (error) {
    console.log(error);
    await delay(2000);
  }
}
