import ipc from "@node-ipc/node-ipc";
import { tmpdir } from "node:os";
import { join } from "node:path";

const socketPath = join(tmpdir(), `node-ipc-guide-${process.pid}.sock`);
const responses = new Set();
const timeout = setTimeout(() => {
  console.error("Timed out waiting for command responses.");
  process.exit(1);
}, 7000);

function finish(requestId) {
  responses.add(requestId);
  if (responses.size !== 2) return;

  clearTimeout(timeout);
  ipc.disconnect("guide-server");
  ipc.server.stop();
}

ipc.config.id = "guide-commands";
ipc.config.silent = true;
ipc.config.retry = 100;

ipc.serve(socketPath, () => {
  ipc.server.on("math.add", (request, socket) => {
    console.log("SERVER received:", JSON.stringify(request));
    if (
      typeof request.requestId !== "string" ||
      !Number.isFinite(request.left) ||
      !Number.isFinite(request.right)
    ) {
      ipc.server.emit(socket, "math.error", {
        requestId: request.requestId ?? "unknown",
        message: "Expected a request ID and two finite numbers."
      });
      return;
    }

    ipc.server.emit(socket, "math.result", {
      requestId: request.requestId,
      result: request.left + request.right
    });
  });
});

ipc.server.on("start", () => {
  console.log("SERVER ready for math.add commands");

  ipc.connectTo("guide-server", socketPath, () => {
    const client = ipc.of["guide-server"];
    client.on("connect", () => {
      console.log("CLIENT connected");
      client.on("math.result", (result) => {
        console.log("CLIENT received result:", JSON.stringify(result));
        finish(result.requestId);
      });
      client.on("math.error", (error) => {
        console.log("CLIENT received error:", JSON.stringify(error));
        finish(error.requestId);
      });

      client.emit("math.add", { requestId: "add-1", left: 19, right: 23 });
      client.emit("math.add", { requestId: "add-2", left: 19, right: "23" });
    });
  });
});

ipc.server.on("error", (error) => {
  console.error("IPC server error:", error.message);
  clearTimeout(timeout);
  process.exitCode = 1;
});

ipc.server.start();
