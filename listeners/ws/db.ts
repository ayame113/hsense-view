import { socketRouter } from "../router.ts";
import { database } from "../../db/mod.ts";
import { Writer } from "../../db/mod.ts";

/** ユーザーから送信されてくるデータ(k-v形式)の制限(kの数の最大値) */
const DATA_MAX_LENGTH = 20;

const ERR_FAILED_TO_VERIFY_TOKEN = "error: failed to verify token.";
const ERR_INVALID_DATA_FORMAT =
  "error: data format is invalid. The data must be json data with up to 20 keys in one hierarchy and an associative array of numbers, and the time property is required.";
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
      const writerPromise = database.getWriter(id, event.data);
      writerPromise.then((writer) => {
        if (!writer) {
          return closeSocket(socket, event, 1008, ERR_FAILED_TO_VERIFY_TOKEN);
        }
      });
      addDataMessageListener(
        socket,
        new BroadcastChannel(`data.${id}`),
        writerPromise,
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
  socket.addEventListener("close", () => {
    channel.close();
  });
  socket.addEventListener("error", () => {
    channel.close();
  });
  socket.addEventListener("message", async (event) => {
    try {
      const writer = await writerPromise;
      if (!writer) {
        return closeSocket(socket, event, 1008, ERR_FAILED_TO_VERIFY_TOKEN);
      }
      let data: json;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        console.error(e);
        return closeSocket(socket, event, 1003, ERR_INVALID_DATA_FORMAT);
      }
      if (!validateData(data)) {
        return closeSocket(socket, event, 1003, ERR_INVALID_DATA_FORMAT);
      }
      channel.postMessage(event.data);
      await writer.write(data);
    } catch (e) {
      console.error(e);
      return closeSocket(socket, event, 1001, ERR_INTERNAL_SERVER_ERROR);
    }
  });
}

type json =
  | string
  | number
  | boolean
  | null
  | json[]
  | { [key: string]: json };

function validateData(
  data: json,
): data is { time: number; [key: string]: number } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  const keys = Object.keys(data);
  if (DATA_MAX_LENGTH + 1 /*time propertyの分*/ < keys.length) {
    return false;
  }
  if (typeof data["time"] !== "number") {
    return false;
  }
  for (const key of keys) {
    if (typeof data[key] !== "number") {
      return false;
    }
  }
  return true;
}
