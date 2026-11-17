# Learn Node.js by Building: A TypeScript Project Guide

This guide walks through eight small projects. Each one adds a Node.js concept on top of the last, and each includes a scaffold (folder layout, setup commands, and starter code) plus a checklist for finishing.

Keep each project in its own folder under `projects/` in this repo:

```text
node-ipc-guide/
├── README.md
├── guide.md              ← this file
└── projects/
    ├── 01-notes-cli/
    ├── 02-dir-search/
    ├── 03-raw-http-api/
    ├── 04-fastify-api/
    ├── 05-sqlite-api/
    ├── 06-job-queue/
    ├── 07-ipc-tool/
    └── 08-cli-package/
```

---

## Prerequisites

- Node.js 22 or newer (`node -v`); a current LTS release is recommended. The existing IPC guide in `README.md` has its own Node 18 minimum.
- npm
- Familiarity with TypeScript (strict mode)

---

## Getting started: your first project

You do **not** need to copy the starter code or type the individual package setup
commands. The scaffold script does that for you.

### 1. Check your tools

Open a terminal in VS Code (**Terminal > New Terminal**) and run:

```sh
node -v
npm -v
```

The Node version must be 22 or newer. If either command is not found, install a
current LTS version from [nodejs.org](https://nodejs.org/), reopen the terminal,
and check again.

### 2. Create Project 1

In the terminal, change to the `node-ipc-guide` folder containing this guide and
`scaffold.mjs`. If VS Code is already open to this folder, the terminal normally
starts there. Run:

```sh
node scaffold.mjs 1
```

The script creates `projects/01-notes-cli`, writes the starter files, and runs
`npm install` in that folder. Wait for the `Ready:` message. You need network
access to your configured npm registry.

### 3. Run the notes CLI

In the same terminal, enter the new project and add a note:

```sh
cd projects/01-notes-cli
npm start -- add "Learn Node.js"
npm start -- list
```

For a new project with no notes, you should see `Added note 1`, followed by
`[ ] 1: Learn Node.js` (npm also prints its own command output). The `--` passes
the following arguments to the program. The note is saved in `notes.json` in
the current directory, so it remains there between commands.

`notes.json` does not exist until you add your first note. Look at it now:

```sh
cat notes.json
```

You should see a JSON array with one note, like this (your `createdAt` will
differ):

```json
[
  {
    "id": 1,
    "text": "Learn Node.js",
    "done": false,
    "createdAt": "2026-01-01T12:00:00.000Z"
  }
]
```

This file is your notes database. `add` reads it, appends a note, and writes it
back. The file is created in the folder where you run the command, so run
commands from `projects/01-notes-cli`. To store it elsewhere, set
`NOTES_FILE=/path/to/notes.json`. The project's `.gitignore` excludes it, so
your notes are not committed.

Check that the starter code compiles and run the test command:

```sh
npm run build
npm test
```

The initial test is marked **TODO**, not a completed test. A successful test
command does not mean you have finished the project.

### 4. Explore and make your first change

In VS Code, open `projects/01-notes-cli/src/index.ts`. Find the `add` and `list`
cases and the TODO for `done` and `delete`. Then read `src/store.ts` to see how
the CLI loads and saves the JSON file, and `src/types.ts` for the `Note` type.

Start by implementing `done <id>`: find the matching note, set `done` to `true`,
and save it. Report an error and return a non-zero exit code for an invalid or
unknown ID. Try it from `projects/01-notes-cli`:

```sh
npm start -- done 1
npm start -- list
```

The list should show `[x] 1: Learn Node.js`. Then implement `delete`, add tests,
and work through the remaining steps and checklist in [Project 1](#project-1-notes-cli).

### 5. Continue to the next project

Once Project 1 is complete, return to the repository folder and create Project 2:

```sh
cd ../..
node scaffold.mjs 2
cd projects/02-dir-search
```

The `cd ../..` command assumes you are still inside `projects/01-notes-cli`.
Use project numbers `1` through `8` with the scaffold script. It copies each
project's `src/*.ts` code blocks from this guide, creates shared configuration
and a placeholder test, and installs the required packages. Project 8 copies
the source and tests from your completed Project 1 instead.

The script refuses to overwrite an existing project. If installation fails, the
generated folder is kept: fix the reported error and run `npm install` in that
folder. Packages are downloaded from the configured npm registry.

The scaffolds are **starting points**, not finished projects. Project 1 starts
with `add` and `list`; other unfinished entry points explain what to implement
when run. Read each project's steps and write your own implementation and tests.

### Shared configuration

The script creates a `tsconfig.json` equivalent to:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

Notes on the shared setup:

- `"type": "module"` makes the project ESM. With `NodeNext`, relative imports must include the `.js` extension even in `.ts` files, for example `import { x } from "./store.js"`.
- `tsx` runs TypeScript directly for development. `tsc` produces `dist/` for production builds.
- `node:test` is built into Node, so no test framework is needed to start.

It also creates a `.gitignore` in each project:

```text
node_modules/
dist/
*.db
*.db-shm
*.db-wal
notes.json
```

---

## Project 1: Notes CLI

**Goal:** A command-line notes manager with `add`, `list`, `done`, and `delete`. Data is stored in a JSON file.

**Concepts:** `process.argv`, `node:fs/promises`, `node:path`, `node:url`, typed data, error handling, exit codes.

### Scaffold

```text
01-notes-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts      # CLI entry point and command dispatch
│   ├── types.ts      # Note type
│   └── store.ts      # Read/write notes.json
└── test/
    └── starter.test.ts # placeholder; add your own store tests
```

`src/types.ts`:

```ts
export interface Note {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
}
```

`src/store.ts`:

```ts
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Note } from "./types.js";

const DB_PATH = resolve(process.env.NOTES_FILE ?? "notes.json");

export async function loadNotes(): Promise<Note[]> {
  try {
    return JSON.parse(await readFile(DB_PATH, "utf8")) as Note[];
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return [];
    throw err;
  }
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await writeFile(DB_PATH, JSON.stringify(notes, null, 2));
}
```

`src/index.ts`:

```ts
import { loadNotes, saveNotes } from "./store.js";

const [command, ...args] = process.argv.slice(2);

async function main(): Promise<number> {
  const notes = await loadNotes();

  switch (command) {
    case "add": {
      const text = args.join(" ").trim();
      if (!text) return usage("add <text>");
      const id = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
      notes.push({ id, text, done: false, createdAt: new Date().toISOString() });
      await saveNotes(notes);
      console.log(`Added note ${id}`);
      return 0;
    }
    case "list": {
      for (const n of notes) console.log(`${n.done ? "[x]" : "[ ]"} ${n.id}: ${n.text}`);
      return 0;
    }
    // TODO: implement "done <id>" and "delete <id>"
    default:
      return usage("add | list | done | delete");
  }
}

function usage(hint: string): number {
  console.error(`Usage: notes ${hint}`);
  return 1;
}

main().then((code) => (process.exitCode = code), (err) => {
  console.error(err);
  process.exitCode = 1;
});
```

### Steps

1. Implement `done <id>` and `delete <id>`. Validate that the id exists and return exit code `1` if not.
2. Handle a corrupted `notes.json` with a clear error message, not a stack trace.
3. Add tests for `store.ts` using a temporary file path set via `NOTES_FILE`. The path is resolved when the module loads, so set the environment variable before importing it, or refactor the store to accept a path.

### Done when

- [ ] All four commands work from `npm start -- <command>`
- [ ] Non-zero exit codes on bad input
- [ ] Tests pass with `npm test`

---

## Project 2: Directory Search Tool

**Goal:** Recursively search a directory for files matching a pattern and report line matches with counts.

**Concepts:** async generators, `fs.promises.readdir`, `readline` for streaming large files, `AbortController`, streaming output.

### Scaffold

```text
02-dir-search/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts     # argument parsing and output
│   ├── walk.ts      # async generator yielding file paths
│   └── search.ts    # stream a file line by line
└── test/
    └── search.test.ts
```

Setup: run `node scaffold.mjs 2` from the repository root. No extra dependencies.

`src/walk.ts`:

```ts
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}
```

`src/search.ts`:

```ts
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export async function searchFile(path: string, pattern: RegExp): Promise<number[]> {
  const hits: number[] = [];
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    pattern.lastIndex = 0;
    if (pattern.test(line)) hits.push(lineNo);
  }
  return hits;
}
```

`src/index.ts` should accept `<dir> <regex>` and an optional `--ext .ts` filter.

### Steps

1. Print matches as `path:line: text`, not just line numbers. You'll need to pass the line text through `searchFile`.
2. Add `--ext` filtering and skip `node_modules` and `.git` by default.
3. Stop on `Ctrl+C` using an `AbortController` tied to `process.on("SIGINT")`.
4. Compare timing against `grep -rn` on a large folder. Note the difference in your README.

### Done when

- [ ] Searches a directory tree correctly, including nested folders
- [ ] Does not load whole files into memory
- [ ] Exits cleanly on `Ctrl+C`

---

## Project 3: Raw HTTP JSON API

**Goal:** A REST API for notes using only `node:http`, with no framework.

**Concepts:** request and response objects, manual routing, reading request bodies, status codes, JSON parsing and error handling.

### Scaffold

```text
03-raw-http-api/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts     # http server and router
│   ├── http-utils.ts # readJson, sendJson helpers
│   ├── notes.ts      # in-memory notes store (copy logic from Project 1)
│   └── types.ts
└── test/
    └── api.test.ts
```

Setup: run `node scaffold.mjs 3` from the repository root. No extra dependencies. The start script runs `src/server.ts`.

`src/http-utils.ts`:

```ts
import type { IncomingMessage, ServerResponse } from "node:http";

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
```

`src/server.ts`:

```ts
import { createServer } from "node:http";
import { sendJson } from "./http-utils.js";

const PORT = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/notes") {
    sendJson(res, 200, { notes: [] }); // replace with notes.list()
    return;
  }
  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Listening on http://127.0.0.1:${PORT}`);
});
```

Test with `curl -i http://127.0.0.1:3000/notes`.

### Steps

1. Implement `GET /notes`, `GET /notes/:id`, `POST /notes`, and `DELETE /notes/:id`.
2. Return `400` for invalid JSON and `422` for a missing `text` field.
3. Handle `POST` bodies larger than 1 MB by rejecting the request.
4. Write tests that start the server on port `0` and make real HTTP requests.

### Done when

- [ ] All four routes work with `curl`
- [ ] Malformed input returns a JSON error, never a crash
- [ ] You can explain what a framework would add that you wrote by hand here

---

## Project 4: Fastify Version of the API

**Goal:** Rebuild Project 3 with Fastify and validate input with `zod`.

**Concepts:** framework routing, plugins, schema validation, typed handlers, centralized error handling.

### Scaffold

```text
04-fastify-api/
├── package.json
├── tsconfig.json
├── src/
│   ├── app.ts        # buildApp() returns a configured Fastify instance
│   ├── index.ts      # starts the server
│   ├── schemas.ts    # zod schemas
│   └── notes.ts      # store (reuse from Project 3)
└── test/
    └── app.test.ts
```

Setup: run `node scaffold.mjs 4` from the repository root. The script installs Fastify and Zod.

`src/schemas.ts`:

```ts
import { z } from "zod";

export const createNoteSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export type CreateNote = z.infer<typeof createNoteSchema>;
```

`src/app.ts`:

```ts
import Fastify from "fastify";
import { z } from "zod";
import { createNoteSchema } from "./schemas.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/notes", async () => {
    return { notes: [] }; // replace with store
  });

  app.post("/notes", async (request, reply) => {
    const parsed = createNoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ errors: z.flattenError(parsed.error) });
    }
    return reply.code(201).send({ text: parsed.data.text });
  });

  return app;
}
```

`src/index.ts`:

```ts
import { buildApp } from "./app.js";

const app = buildApp();
await app.listen({ port: Number(process.env.PORT ?? 3000), host: "127.0.0.1" });
```

### Steps

1. Add `GET /notes/:id`, `PATCH /notes/:id`, and `DELETE /notes/:id`.
2. Record request duration using an `onRequest` hook and log it in an `onResponse` hook.
3. Add a custom error handler with `app.setErrorHandler` that hides internal details in production.
4. Use `app.inject()` in tests instead of starting a real port. Compare this to Project 3's approach.

### Done when

- [ ] Invalid bodies return `422` with field errors
- [ ] Tests use `app.inject()` and pass
- [ ] You can state the difference between a middleware hook and a route handler

---

## Project 5: SQLite Persistence

**Goal:** Replace the in-memory or JSON store with SQLite, keeping the Project 4 API unchanged.

**Concepts:** schema design, migrations, parameterized queries (SQL injection prevention), synchronous vs. async database APIs, transactions.

### Scaffold

```text
05-sqlite-api/
├── package.json
├── tsconfig.json
├── src/
│   ├── db.ts         # open database, run schema
│   ├── notes-repo.ts # SQL queries behind typed functions
│   ├── app.ts        # Fastify app from Project 4, using the repo
│   └── index.ts
└── test/
    └── repo.test.ts
```

Setup: run `node scaffold.mjs 5` from the repository root. The script installs Fastify, Zod, `better-sqlite3`, and its type definitions.

The scaffold script installs this dependency. `better-sqlite3` may need to compile a native module if no prebuilt binary is available. On macOS, install Xcode Command Line Tools (`xcode-select --install`) if needed.

Alternative: Node 22.5+ includes an experimental `node:sqlite` module with no native dependency. Use it if you want to avoid native builds.

`src/db.ts`:

```ts
import Database from "better-sqlite3";

export function openDb(path = process.env.DB_PATH ?? "notes.db") {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}
```

`src/notes-repo.ts`:

```ts
import type Database from "better-sqlite3";

export function notesRepo(db: Database.Database) {
  const insert = db.prepare("INSERT INTO notes (text) VALUES (?)");
  const all = db.prepare("SELECT id, text, done FROM notes ORDER BY id");

  return {
    create(text: string) {
      const info = insert.run(text);
      return { id: Number(info.lastInsertRowid), text, done: false };
    },
    list() {
      const rows = all.all() as { id: number; text: string; done: 0 | 1 }[];
      return rows.map((row) => ({ ...row, done: row.done === 1 }));
    },
  };
}
```

### Steps

1. Add `findById`, `update`, and `delete` queries. Always use `?` placeholders, never string concatenation.
2. Wrap a bulk import in `db.transaction(...)` and measure the difference against individual inserts.
3. Add a `schema_version` table and a simple migration function that runs on startup.
4. Write a SQL injection test: send `'; DROP TABLE notes; --` as note text and confirm the table still exists.

### Done when

- [ ] The Project 4 routes work against SQLite
- [ ] Data survives a server restart
- [ ] All queries use bound parameters

---

## Project 6: Event-Driven Job Queue

**Goal:** An in-process job queue that runs async jobs with concurrency limits, emits typed events, and shuts down gracefully.

**Concepts:** `EventEmitter` with TypeScript types, timers, `AbortController`, process signals, promise concurrency control.

### Scaffold

```text
06-job-queue/
├── package.json
├── tsconfig.json
├── src/
│   ├── queue.ts     # JobQueue class
│   ├── jobs.ts      # sample job handlers
│   └── index.ts     # demo run
└── test/
    └── queue.test.ts
```

Setup: run `node scaffold.mjs 6` from the repository root. No extra dependencies.

`src/queue.ts`:

```ts
import { EventEmitter } from "node:events";

export interface Job<T = unknown> {
  id: number;
  name: string;
  run: (signal: AbortSignal) => Promise<T>;
}

interface QueueEvents {
  "job:started": [id: number];
  "job:done": [id: number, result: unknown];
  "job:failed": [id: number, error: Error];
}

export class JobQueue extends EventEmitter<QueueEvents> {
  #pending: Job[] = [];
  #active = new Set<Promise<void>>();
  #controller = new AbortController();
  #nextId = 1;
  #closed = false;

  constructor(private readonly concurrency = 2) {
    super();
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new RangeError("Concurrency must be a positive integer");
    }
  }

  add<T>(name: string, run: Job<T>["run"]): number {
    if (this.#closed) throw new Error("Queue is shut down");
    const id = this.#nextId++;
    this.#pending.push({ id, name, run });
    this.#drain();
    return id;
  }

  #drain(): void {
    while (!this.#closed && this.#active.size < this.concurrency && this.#pending.length > 0) {
      const job = this.#pending.shift();
      if (!job) break;
      const task = Promise.resolve()
        .then(() => {
          this.emit("job:started", job.id);
          return job.run(this.#controller.signal);
        })
        .then(
          (result) => { this.emit("job:done", job.id, result); },
          (error: unknown) => {
            this.emit("job:failed", job.id, error instanceof Error ? error : new Error(String(error)));
          },
        )
        .finally(() => {
          this.#active.delete(task);
          this.#drain();
        });
      this.#active.add(task);
    }
  }

  async shutdown(): Promise<void> {
    this.#closed = true;
    this.#controller.abort();
    this.#pending = [];
    await Promise.all(this.#active);
  }
}
```

`src/index.ts` should add several jobs with different delays, listen to all three events, and call `shutdown()` on `SIGINT`.
Jobs must cooperate with the abort signal; shutdown waits for running jobs to settle.

### Steps

1. Implement a `sleep(ms, signal)` helper that rejects when the signal aborts. Use it in sample jobs.
2. Add per-job timeouts using `AbortSignal.timeout()` combined with the queue signal (`AbortSignal.any`).
3. Add a `drain()` method that resolves when the queue is empty and no jobs are running.
4. Add retry support with exponential backoff for failed jobs.

### Done when

- [ ] Concurrency never exceeds the configured limit (write a test that proves it)
- [ ] `Ctrl+C` stops new work and cancels running jobs
- [ ] Events are typed, so a wrong event name fails to compile

---

## Project 7: Local IPC Tool

**Goal:** A server that accepts typed commands from a client over a local socket, using the `@node-ipc/node-ipc` package from this repo's README.

**Concepts:** IPC protocols, shared TypeScript contracts between processes, request/response correlation, connection lifecycle, the event loop across processes.

### Scaffold

```text
07-ipc-tool/
├── package.json
├── tsconfig.json
├── src/
│   ├── protocol.ts  # shared message types (client and server import this)
│   ├── server.ts
│   └── client.ts
└── test/
    └── protocol.test.ts
```

Setup: run `node scaffold.mjs 7` from the repository root. The script installs `@node-ipc/node-ipc`; use `npm start` for the server and `npm run client` for the client after implementing them.

Do not install the historical `node-ipc` package. The README in this repo explains why.

`src/protocol.ts`:

```ts
export type Request =
  | { type: "math.add"; a: number; b: number }
  | { type: "echo"; text: string };

export type Response =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

export function isRequest(value: unknown): value is Request {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  if (value.type === "math.add") {
    return "a" in value && typeof value.a === "number" && Number.isFinite(value.a)
      && "b" in value && typeof value.b === "number" && Number.isFinite(value.b);
  }
  return value.type === "echo" && "text" in value && typeof value.text === "string";
}
```

`src/server.ts` should follow the README's **Basic API** section: set `ipc.config.id`, use `ipc.serve(...)`, listen on `app.message`-style events, validate with `isRequest`, and reply with `ipc.server.emit(socket, ...)`.

`src/client.ts` should use `ipc.connectTo(...)`, wait for `connect`, send one request, print the response, then call `ipc.disconnect(...)`.

### Steps

1. Route `math.add` and `echo`. Return `{ ok: false, error }` for unknown or invalid requests, never crash the server.
2. Add a `stats` command that counts requests by type.
3. Support multiple clients and confirm the server handles them independently.
4. Add a `broadcast` command that sends a notice to all connected clients.

### Done when

- [ ] Client and server import the same `protocol.ts` types
- [ ] Invalid input from a client produces an error response, not a server crash
- [ ] You can explain why the `Request` type is shared rather than duplicated

---

## Project 8: Tests and Packaging as a CLI

**Goal:** Take Project 1 (or your favorite earlier project), add a real test suite, and publish it as an installable command.

**Concepts:** `node:test` structure, coverage, the `bin` field in `package.json`, building with `tsc`, local linking, versioning.

### Scaffold

After finishing Project 1, return to the repository root and run:

```sh
node scaffold.mjs 8
cd projects/08-cli-package
```

The script copies Project 1's source and tests (not its data or `node_modules`),
adds the shebang and package settings, and installs dependencies. It leaves the
package marked `private`; remove that setting only if you intend to publish it.

Then build and link:

```sh
npm run build
npm link
notes add "Ship it"
notes list
```

### Steps

1. Add tests for every command, using a temporary `NOTES_FILE` per test with `t.after` for cleanup.
2. Run `node --import tsx --test --experimental-test-coverage test/*.test.ts` and aim for coverage above 80% on `store.ts`.
3. Add a `README.md` with install and usage instructions.
4. Run `npm pack --dry-run` and confirm only `dist/`, `package.json`, and `README.md` are included.
5. Bump the version with `npm version patch --no-git-tag-version` and inspect the changed package files. This command does not create a changelog.

### Done when

- [ ] `npm link` makes `notes` available from any directory
- [ ] `npm pack --dry-run` shows only the intended files
- [ ] Tests cover every command, including the error paths

---

## How to Work Through This Guide

- **Pace:** 1 to 2 weeks per project. Finish each checklist before starting the next.
- **Keep a log:** Add a short `LEARNINGS.md` to each project noting what surprised you.
- **Read the docs first:** Before using a new module, read its official Node.js or package documentation.
- **Rebuild, don't copy:** Projects 3 and 4 are meant to show the same API two ways. Type the code yourself.
- **Strict mode always:** If the compiler complains, fix the types rather than adding `any` or `!`.

## Next Steps After Project 8

- Add logging with `pino`, configuration with environment validation, and graceful shutdown to Project 4 or 5.
- Containerize the API with Docker.
- Explore worker threads (`node:worker_threads`) for CPU-heavy jobs.
- Read the Node.js source for `EventEmitter` and `fs` to see how the built-ins are implemented.
