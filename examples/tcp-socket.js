import ipc from "@node-ipc/node-ipc";
import { createServer as createNetServer } from "node:net";

const host = "127.0.0.1";
const timeout = setTimeout(() => {
  console.error("Timed out waiting for the TCP reply.");
  process.exit(1);
}, 7000);

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, host, () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not determine an available TCP port."));
        return;
      }
      probe.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function run() {
  const port = await findAvailablePort();

  ipc.config.id = "guide-server";
  ipc.config.silent = true;
  ipc.config.retry = 100;
  ipc.config.networkHost = host;
  ipc.config.networkPort = port;

  ipc.serveNet(host, port, () => {
    ipc.server.on("app.message", (message, socket) => {
      console.log("SERVER received:", JSON.stringify(message));
      ipc.server.emit(socket, "app.reply", {
        from: "server",
        message: `Hello, ${message.name}!`
      });
    });
  });

  ipc.server.on("start", () => {
    console.log(`SERVER listening on ${host}:${port}`);

    ipc.connectToNet("guide-server", host, port, () => {
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
}

run().catch((error) => {
  console.error("Could not start TCP demo:", error.message);
  clearTimeout(timeout);
  process.exitCode = 1;
});
