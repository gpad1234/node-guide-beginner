# Node IPC Guide

An interactive, local-first guide for learning the maintained [`@node-ipc/node-ipc`](https://github.com/node-ipc/node-ipc) package. It includes runnable local-socket and TCP examples, plus patterns for command routing, input validation, progress events, and broadcasting to multiple clients.

## Requirements

- Node.js 18 or newer
- npm

## Run the guide

```sh
npm install
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The server binds to loopback only; set `PORT` to use another port (the default is `3000`). Select a lesson and choose **Run example** to start its prewritten client/server demo.

For a broader hands-on Node.js learning path in TypeScript, see [guide.md](./guide.md). Its project scaffolding script requires Node.js 22 or newer.

## What is IPC?

Inter-process communication (IPC) lets separate processes exchange information. A typical setup has a server listen for connections, a client connect, and both sides exchange named events and data.

The demos in this guide send `{ "name": "Node IPC" }` on `app.message`. The server receives it and answers on `app.reply` with `{ "from": "server", "message": "Hello, Node IPC!" }`.

## Choosing a transport

| Transport | Use it when | In this guide |
| --- | --- | --- |
| Unix / Windows local socket | Both processes are on the same machine. It uses a local socket endpoint instead of a network port. | `ipc.serve(path)` and `ipc.connectTo(id, path)` |
| TCP | You need a reliable, ordered connection over IP, including the option to connect between machines. | `ipc.serveNet(host, port)` and `ipc.connectToNet(id, host, port)` |
| UDP | You need low-latency datagrams and can handle dropped or reordered messages yourself. | Not included in the runnable lessons |
| TLS | TCP transport needs encryption and certificate-based authentication. | Not included in the runnable lessons |

The TCP lesson binds to `127.0.0.1`, so it demonstrates the API without exposing a listening service to your local network.

## The basic API

The maintained package is published as `@node-ipc/node-ipc`:

```js
import ipc from "@node-ipc/node-ipc";

ipc.config.id = "world";
ipc.config.silent = true;

ipc.serve(() => {
  ipc.server.on("app.message", (message, socket) => {
    ipc.server.emit(socket, "app.reply", {
      message: `Hello, ${message.name}!`
    });
  });
});

ipc.server.start();
```

On the client, connect and listen for the server's reply:

```js
ipc.config.id = "hello";

ipc.connectTo("world", () => {
  ipc.of.world.on("connect", () => {
    ipc.of.world.emit("app.message", { name: "Node IPC" });
  });

  ipc.of.world.on("app.reply", (reply) => {
    console.log(reply.message);
    ipc.disconnect("world");
  });
});
```

For TCP, replace `serve` with `serveNet(host, port, callback)` and `connectTo` with `connectToNet(id, host, port, callback)`. In both cases, the server must be started, and the client should send only after its `connect` event.

## Running and reading the lessons

1. Select a lesson in the lesson list.
2. Read the source and the **What to notice** notes.
3. Choose **Run example**.
4. Follow the output: the server starts, clients connect, and named events carry requests, replies, progress, or broadcasts.

The source panel displays the actual script executed by the guide. The backend accepts only the known lesson IDs and launches only those scripts; it does not evaluate code typed into the browser.

## Example patterns

- **Commands and validation:** route a `math.add` event and return either a result or a validation error. Event names and payload shapes form a protocol shared by both processes.
- **Progress updates:** report multiple progress events and then a distinct completion event. For longer jobs, add cancellation, timeout, and failure semantics.
- **Broadcast:** wait for two clients, then use `ipc.server.broadcast` to send the same notice to both. Use `ipc.server.emit(socket, ...)` when a response belongs to only one client.

The examples use local sockets so they run only on the current machine. TCP shows a separate transport, also bound to loopback. The guide does not expose a network listener or let browser input select arbitrary scripts.

## Troubleshooting

- **The page does not load:** confirm `npm start` is running and open `http://127.0.0.1:3000`.
- **Port 3000 is already in use:** stop the other local service using that port before starting this guide.
- **A lesson fails:** try it again after checking that no other process is using the local socket or TCP resources. The run output includes the error details.
- **You need another transport:** the linked repository has further examples, including UDP and TLS. Review the current package documentation before adapting an example to a network-facing service.

## Safety and package naming

- The guide launches only the scripts listed in its server-side lesson catalog; it does not accept or execute code from the browser.
- The TCP example binds to `127.0.0.1`, not a public network interface.
- Install `@node-ipc/node-ipc`, the maintained package linked from the supplied repository. Avoid installing the historical package named `node-ipc` from old guides.
