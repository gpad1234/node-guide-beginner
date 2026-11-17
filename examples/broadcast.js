import ipc from "@node-ipc/node-ipc";
import { tmpdir } from "node:os";
import { join } from "node:path";

const socketPath = join(tmpdir(), `node-ipc-guide-${process.pid}.sock`);
const clients = ["worker-a", "worker-b"];
let connectedClientCount = 0;
const receivedClients = new Set();
const timeout = setTimeout(() => {
  console.error("Timed out waiting for both clients to receive the update.");
  process.exit(1);
}, 7000);

ipc.config.id = "guide-broadcast";
ipc.config.silent = true;
ipc.config.retry = 100;

ipc.serve(socketPath);

ipc.server.on("connect", () => {
  connectedClientCount += 1;
  console.log(`SERVER connected clients: ${connectedClientCount}`);
  if (connectedClientCount === clients.length) {
    ipc.server.broadcast("app.notice", {
      message: "Maintenance begins in five minutes."
    });
  }
});

ipc.server.on("start", () => {
  console.log("SERVER waiting for two clients");

  for (const id of clients) {
    ipc.connectTo(id, socketPath, () => {
      const client = ipc.of[id];
      client.on("connect", () => {
        console.log(`CLIENT ${id} connected`);
      });
      client.on("app.notice", (notice) => {
        console.log(`CLIENT ${id} received:`, JSON.stringify(notice));
        receivedClients.add(id);
        if (receivedClients.size === clients.length) {
          clearTimeout(timeout);
          clients.forEach((clientId) => ipc.disconnect(clientId));
          ipc.server.stop();
        }
      });
    });
  }
});

ipc.server.on("error", (error) => {
  console.error("IPC server error:", error.message);
  clearTimeout(timeout);
  process.exitCode = 1;
});

ipc.server.start();
