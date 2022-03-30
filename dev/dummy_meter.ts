import { delay } from "https://deno.land/std@0.132.0/async/mod.ts";

// TODO:
// closeしたときに再接続

const api = "wss://socket-graph.deno.dev";
// const api = "ws://localhost:8000";
const TOKEN = "d09d3670-6e08-45cf-935d-cf6cc30a3d5a"; // 本番環境用
// const TOKEN = "c9151f9e-2dbc-4ad8-977d-0a95dd641a9f"; // localhost用

// websocketで送信するやつ
const id = "水道メーター1";
const socktURL = `${api}/ws/send/${id}`;

let 積算流量 = 0;

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
    let pre流量 = 0;
    while (true) {
      await delay(wait);
      const time = Date.now();
      const 瞬時流量 = 7000 < time % 14000
        ? 0.9 + Math.random() * 0.1
        : 0.01 - Math.random() * 0.01;
      // 台形補正
      // 1秒は(1/3600)時間（台形の面積）
      積算流量 += (pre流量 + 瞬時流量) / 2 * (wait / 1000 / 3600);
      const data = {
        time,
        "積算流量（m^3）": 積算流量,
        "瞬時流量（m^3／h）": 瞬時流量,
      };
      console.log(data);
      socket.send(JSON.stringify(data));
      pre流量 = 瞬時流量;
    }
  } catch (error) {
    console.log(error);
    await delay(2000);
  }
}
