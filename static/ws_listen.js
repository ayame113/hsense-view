// @ts-check
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="dom" />

const errorOutput = document.getElementById("ws-error-output");
const output = document.getElementById("ws-output");
export function listenWebSocket() {
  const url = new URL("/ws/date", location.href);
  url.protocol = "ws:";
  const socket = new WebSocket(url);
  socket.addEventListener("close", (e) => {
    console.error(e);
    errorOutput &&
      (errorOutput.innerHTML += `<span>closed: ${e.reason}</span><br>`);
  });
  socket.addEventListener("error", (e) => {
    console.error(e);
    errorOutput && (errorOutput.innerHTML += `<span>error: ${e}</span><br>`);
  });
  socket.addEventListener("message", (e) => {
    const now = Date.now();
    output &&
      (output.insertAdjacentHTML(
        "afterbegin",
        `<span>${new Date(e.data - 0).toLocaleString()} ／ ${
          new Date(now).toLocaleString()
        } 差：${now - e.data} ms</span><br>`,
      ));
  });
}
listenWebSocket();
