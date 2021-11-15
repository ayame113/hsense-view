import { socketRouter } from "../router.ts";

socketRouter.set("/ws/test", ({ socket }) => {
  let counter = 0;
  socket.addEventListener("message", () => socket.send(`${counter++}`));
});

socketRouter.set(
  new URLPattern({ pathname: "/ws/test/:message" }),
  ({ socket, match: { pathname: { groups: { message } } } }) =>
    socket.addEventListener(
      "message",
      (event) => socket.send(`${event.data}, ${message}`),
    ),
);
