import { socketRouter } from "../router.ts";

socketRouter.set("/ws/date", ({ socket }) => {
  const intervalId = setInterval(() => {
    socket.send(`${Date.now()}`);
  }, 1000);
  socket.addEventListener("close", () => {
    console.log(`closed`);
    clearInterval(intervalId);
  });
  socket.addEventListener("error", () => {
    console.log(`error`);
    clearInterval(intervalId);
  });
});
