import { socketRouter } from "../router.ts";
import { database } from "../../db/mod.ts";
import { Writer } from "../../db/mod.ts";

const ERR_FAILED_TO_VERIFY_TOKEN = "error: failed to verify token.";
const ERR_TIME_PROP_NOT_FOUND = "error: time property not found in sent data.";
const ERR_INTERNAL_SERVER_ERROR = "error: Internal Server Error";

function closeSocket(
  socket: WebSocket,
  event: Event,
  code: number,
  reason: string,
) {
  console.error("close socket:\n", reason, "event:\n", Deno.inspect(event));
  socket.close(code, reason);
}

socketRouter.set(
  new URLPattern({ pathname: "/ws/send/:id" }),
  ({ socket, match: { pathname: { groups: { id } } } }) => {
    addTokenMessageListener(socket, id);
  },
);

function addTokenMessageListener(socket: WebSocket, id: string) {
  // 1回目の接続は認証トークンを受け付ける
  socket.addEventListener("message", function firstListener(event) {
    try {
      socket.removeEventListener("message", firstListener);
      if (typeof event.data !== "string") {
        return closeSocket(socket, event, 1008, ERR_FAILED_TO_VERIFY_TOKEN);
      }
      addDataMessageListener(
        socket,
        new BroadcastChannel(`data.${id}`),
        database.getWriter(id, event.data),
      );
    } catch (e) {
      console.error(e);
      return closeSocket(socket, event, 1001, ERR_INTERNAL_SERVER_ERROR);
    }
  });
}

function addDataMessageListener(
  socket: WebSocket,
  channel: BroadcastChannel,
  writerPromise: Promise<Writer | null>,
) {
  // 2回目の接続以降はデータを受け付ける
  socket.addEventListener("message", async (event) => {
    try {
      const writer = await writerPromise;
      if (!writer) {
        return closeSocket(socket, event, 1008, ERR_FAILED_TO_VERIFY_TOKEN);
      }
      const data = JSON.parse(event.data);
      if (!data.time && typeof data.time !== "number") {
        return closeSocket(socket, event, 1003, ERR_TIME_PROP_NOT_FOUND);
      }
      channel.postMessage(event.data);
      await writer.write(data);
    } catch (e) {
      console.error(e);
      return closeSocket(socket, event, 1001, ERR_INTERNAL_SERVER_ERROR);
    }
  });
}
