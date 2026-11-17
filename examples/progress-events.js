import ipc from "@node-ipc/node-ipc";
import { tmpdir } from "node:os";
import { join } from "node:path";

const socketPath = join(tmpdir(), `node-ipc-guide-${process.pid}.sock`);
const timeout = setTimeout(() => {
  console.error("Timed out waiting for the job to finish.");
  process.exit(1);
}, 7000);

ipc.config.id = "guide-progress";
ipc.config.silent = true;
ipc.config.retry = 100;

ipc.serve(socketPath, () => {
  ipc.server.on("job.start", (_request, socket) => {
    console.log("SERVER started job");
    for (const percent of [25, 50, 75, 100]) {
      ipc.server.emit(socket, "job.progress", { percent });
    }
    ipc.server.emit(socket, "job.complete", { status: "done" });
  });
});

ipc.server.on("start", () => {
  console.log("SERVER ready for job.start");

  ipc.connectTo("guide-server", socketPath, () => {
    const client = ipc.of["guide-server"];
    client.on("connect", () => {
      console.log("CLIENT connected; requesting a job");
      client.on("job.progress", ({ percent }) => {
        console.log(`CLIENT progress: ${percent}%`);
      });
      client.on("job.complete", (result) => {
        console.log("CLIENT received:", JSON.stringify(result));
        clearTimeout(timeout);
        ipc.disconnect("guide-server");
        ipc.server.stop();
      });
      client.emit("job.start", { jobId: "demo-job" });
    });
  });
});

ipc.server.on("error", (error) => {
  console.error("IPC server error:", error.message);
  clearTimeout(timeout);
  process.exitCode = 1;
});

ipc.server.start();
