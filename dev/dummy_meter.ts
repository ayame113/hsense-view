import { delay } from "https://deno.land/std@0.125.0/async/mod.ts";

// TODO:
// closeしたときに再接続

// const api = "wss://socket-graph.deno.dev";
const api = "ws://localhost:8000";
// const TOKEN = "d09d3670-6e08-45cf-935d-cf6cc30a3d5a"; // 本番環境用
const TOKEN = "c9151f9e-2dbc-4ad8-977d-0a95dd641a9f"; // localhost用

// websocketで送信するやつ
const id = "水道メーター1";
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

    const wait = 1000;
    while (true) {
      await delay(wait);
      const time = Date.now();
      const 流速origin = 7000 < time % 14000 ? 0.9 : 0.1;
      const 流速 = 流速origin + Math.random() * 0.1;
      流量 += 流速 * (wait / 1000 / 3600); // 1秒は(1/3600)時間
      const data = {
        time,
        "流速（m^3）": 流量,
        "流量（m^3／h）": 流速,
      };
      console.log(data);
      socket.send(JSON.stringify(data));
    }
  } catch (error) {
    console.log(error);
    await delay(2000);
  }
}
