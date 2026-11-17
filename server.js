import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = join(root, "public");
const examples = {
  local: {
    file: "local-socket.js",
    title: "Local socket",
    description: "A client and server exchange a message over a local Unix or Windows socket.",
    transport: "Local socket",
    concepts: [
      "A local socket connects processes on the same machine without using a network port.",
      "The server listens for the app.message event and sends app.reply to the connected client.",
      "Use local sockets when both processes live on one host and low overhead matters."
    ]
  },
  tcp: {
    file: "tcp-socket.js",
    title: "TCP socket",
    description: "A client and server exchange a message over TCP, bound to this machine only.",
    transport: "TCP on 127.0.0.1",
    concepts: [
      "TCP provides a reliable, ordered stream between clients and servers.",
      "The demo binds to 127.0.0.1 and chooses an available port for this run.",
      "TCP can connect processes across machines, but this example deliberately stays local."
    ]
  },
  commands: {
    file: "command-routing.js",
    title: "Commands and validation",
    description: "Route named commands and return either a result or a useful error.",
    transport: "Local socket · request / response",
    concepts: [
      "Event names act like a small protocol: the client sends math.add and listens for a result.",
      "Validate incoming data at the process boundary, even when both processes are yours.",
      "A request ID lets the caller match a response to the request that produced it."
    ]
  },
  progress: {
    file: "progress-events.js",
    title: "Progress updates",
    description: "Send several events during one task instead of waiting for a single reply.",
    transport: "Local socket · event stream",
    concepts: [
      "The server emits progress events as work advances; the client handles each event as it arrives.",
      "Progress is a separate event from the final completion message.",
      "Real jobs should also define cancellation, timeout, and failure behavior."
    ]
  },
  broadcast: {
    file: "broadcast.js",
    title: "Broadcast to clients",
    description: "Connect two clients and send the same update to both from one server.",
    transport: "Local socket · multiple clients",
    concepts: [
      "A server can keep multiple clients connected at once.",
      "broadcast sends one event to every connected client; emit(socket, ...) targets one.",
      "The demo waits for both clients before broadcasting so neither misses the update."
    ]
  }
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024) {
      throw new Error("Request body is too large.");
    }
  }
  return JSON.parse(body);
}

function runExample(id) {
  const example = examples[id];
  if (!example) {
    return Promise.reject(new Error("Unknown example."));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, "examples", example.file)], {
      cwd: root,
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let finished = false;
    let timedOut = false;

    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > 16_384) {
        child.kill("SIGKILL");
      }
    };

    child.stdout.on("data", append);
    child.stderr.on("data", append);

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 10_000);

    child.on("error", (error) => {
      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        reject(error);
      }
    });

    child.on("close", (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);

      resolve({
        ok: code === 0 && !timedOut,
        output: output.slice(0, 16_384).trim(),
        timedOut,
        exitCode: code,
        signal
      });
    });
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "GET" && url.pathname === "/api/examples") {
    sendJson(response, 200, Object.entries(examples).map(([id, example]) => ({
      id,
      title: example.title,
      description: example.description,
      transport: example.transport,
      concepts: example.concepts,
      file: example.file
    })));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/source") {
    const id = url.searchParams.get("id");
    const example = examples[id];
    if (!example) {
      sendJson(response, 404, { error: "Unknown example." });
      return;
    }

    try {
      const source = await readFile(join(root, "examples", example.file), "utf8");
      sendJson(response, 200, { source });
    } catch (error) {
      console.error("Could not read example source:", error);
      sendJson(response, 500, { error: "Could not load this example's source." });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/run") {
    try {
      const body = await readRequestBody(request);
      if (typeof body.id !== "string" || !examples[body.id]) {
        sendJson(response, 400, { error: "Choose a listed example to run." });
        return;
      }

      const result = await runExample(body.id);
      sendJson(response, result.ok ? 200 : 500, result);
    } catch (error) {
      console.error("Could not run example:", error);
      sendJson(response, 400, {
        error: error instanceof SyntaxError ? "Request body must be valid JSON." : error.message
      });
    }
    return;
  }

  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET, POST" });
    response.end("Method not allowed");
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(publicRoot, normalizedPath);
  if (!filePath.startsWith(publicRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new Error("PORT must be an integer between 0 and 65535.");
}

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine the guide server's listening port.");
  }
  console.log(`Node IPC Guide is ready at http://127.0.0.1:${address.port}`);
});

server.on("error", (error) => {
  console.error("The guide server could not start:", error);
  process.exitCode = 1;
});
