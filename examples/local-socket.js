import ipc from "@node-ipc/node-ipc";
import { tmpdir } from "node:os";
import { join } from "node:path";

const socketPath = join(tmpdir(), `node-ipc-guide-${process.pid}.sock`);
const timeout = setTimeout(() => {
  console.error("Timed out waiting for the local socket reply.");
  process.exit(1);
}, 7000);

ipc.config.id = "guide-server";
ipc.config.silent = true;
ipc.config.retry = 100;

ipc.serve(socketPath, () => {
  ipc.server.on("app.message", (message, socket) => {
    console.log("SERVER received:", JSON.stringify(message));
    ipc.server.emit(socket, "app.reply", {
      from: "server",
      message: `Hello, ${message.name}!`
    });
  });
});

ipc.server.on("start", () => {
  console.log("SERVER listening on a local socket");

  ipc.connectTo("guide-server", socketPath, () => {
    ipc.of["guide-server"].on("connect", () => {
      console.log("CLIENT connected");
      ipc.of["guide-server"].emit("app.message", { name: "Node IPC" });
    });

    ipc.of["guide-server"].on("app.reply", (reply) => {
      console.log("CLIENT received:", JSON.stringify(reply));
      clearTimeout(timeout);
      ipc.disconnect("guide-server");
      ipc.server.stop();
    });
  });
});

ipc.server.on("error", (error) => {
  console.error("IPC server error:", error.message);
  clearTimeout(timeout);
  process.exitCode = 1;
});

ipc.server.start();
