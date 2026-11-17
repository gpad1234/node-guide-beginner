#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projects = [
  { name: "01-notes-cli", files: ["types.ts", "store.ts", "index.ts"] },
  { name: "02-dir-search", files: ["walk.ts", "search.ts"] },
  { name: "03-raw-http-api", files: ["http-utils.ts", "server.ts"], entry: "server.ts" },
  {
    name: "04-fastify-api",
    files: ["schemas.ts", "app.ts", "index.ts"],
    dependencies: { fastify: "^5.0.0", zod: "^4.6.7" },
  },
  {
    name: "05-sqlite-api",
    files: ["db.ts", "notes-repo.ts"],
    dependencies: { fastify: "^5.0.0", zod: "^4.6.7", "better-sqlite3": "^11.10.0" },
    devDependencies: { "@types/better-sqlite3": "^7.6.13" },
  },
  { name: "06-job-queue", files: ["queue.ts"] },
  {
    name: "07-ipc-tool",
    files: ["protocol.ts"],
    entry: "server.ts",
    dependencies: { "@node-ipc/node-ipc": "^11.0.3" },
  },
  { name: "08-cli-package", files: [] },
];

function extractExamples(guide, number) {
  const heading = `## Project ${number}:`;
  const start = guide.indexOf(heading);
  if (start < 0) throw new Error(`Missing guide section: ${heading}`);
  const end = guide.indexOf("\n## Project ", start + heading.length);
  const section = guide.slice(start, end === -1 ? undefined : end);
  const examples = new Map();
  const pattern = /^`src\/([^/`\n]+\.ts)`:\s*\n\s*```ts\n([\s\S]*?)\n```/gm;
  for (const match of section.matchAll(pattern)) {
    if (examples.has(match[1])) throw new Error(`Duplicate example: ${match[1]}`);
    examples.set(match[1], `${match[2]}\n`);
  }
  return examples;
}

async function main() {
  const argument = process.argv[2];
  if (process.argv.length !== 3 || !/^[1-8]$/.test(argument ?? "")) {
    throw new Error("Usage: node scaffold.mjs <project number 1-8>");
  }
  if (Number(process.versions.node.split(".")[0]) < 22) {
    throw new Error("The project scaffolds require Node.js 22 or newer.");
  }

  const number = Number(argument);
  const project = projects[number - 1];
  const target = join(root, "projects", project.name);
  const examples = extractExamples(await readFile(join(root, "guide.md"), "utf8"), number);
  for (const name of project.files) {
    if (!examples.has(name)) throw new Error(`Missing src/${name} example in project ${number}`);
  }

  const source = join(root, "projects", projects[0].name);
  if (number === 8) {
    try {
      await readFile(join(source, "src", "index.ts"));
    } catch (error) {
      throw new Error(`Project 8 requires Project 1 first: ${source}`, { cause: error });
    }
  }

  await mkdir(join(root, "projects"), { recursive: true });
  try {
    await mkdir(target);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`Project already exists; no files were overwritten: ${target}`);
    }
    throw error;
  }

  const scripts = {
    start: `tsx src/${project.entry ?? "index.ts"}`,
    build: "tsc",
    test: "node --import tsx --test test/*.test.ts",
  };
  if (number === 7) scripts.client = "tsx src/client.ts";
  const manifest = {
    name: project.name,
    version: "0.1.0",
    private: true,
    type: "module",
    engines: { node: ">=22" },
    scripts,
    ...(project.dependencies && { dependencies: project.dependencies }),
    devDependencies: {
      "@types/node": "^22.0.0",
      tsx: "^4.20.0",
      typescript: "^5.9.0",
      ...project.devDependencies,
    },
    ...(number === 8 && { bin: { notes: "./dist/index.js" }, files: ["dist"] }),
  };
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      outDir: "dist",
      rootDir: "src",
      skipLibCheck: true,
      esModuleInterop: true,
    },
    include: ["src"],
  };

  await writeFile(join(target, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(target, "tsconfig.json"), `${JSON.stringify(tsconfig, null, 2)}\n`);
  await writeFile(join(target, ".gitignore"), "node_modules/\ndist/\n*.db\n*.db-shm\n*.db-wal\nnotes.json\n");
  if (number === 8) {
    await cp(join(source, "src"), join(target, "src"), { recursive: true });
    await cp(join(source, "test"), join(target, "test"), { recursive: true });
    const entry = join(target, "src", "index.ts");
    const code = await readFile(entry, "utf8");
    if (!code.startsWith("#!")) await writeFile(entry, `#!/usr/bin/env node\n${code}`);
  } else {
    await mkdir(join(target, "src"));
    await mkdir(join(target, "test"));
    for (const name of project.files) {
      await writeFile(join(target, "src", name), examples.get(name));
    }
    const missingEntries = number === 7 ? ["server.ts", "client.ts"] : [project.entry ?? "index.ts"];
    for (const name of missingEntries) {
      if (!examples.has(name)) {
        await writeFile(
          join(target, "src", name),
          `console.error("Implement src/${name} using the Project ${number} instructions in guide.md.");\nprocess.exitCode = 1;\n`,
        );
      }
    }
    await writeFile(
      join(target, "test", "starter.test.ts"),
      `import { test } from "node:test";\n\ntest.todo("Add tests for Project ${number}");\n`,
    );
  }

  console.log(`Created ${target}. Installing its dependencies...`);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["install"], {
    cwd: target,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    throw new Error(`npm install failed. Fix the error and run npm install in ${target}.`, { cause: result.error });
  }
  console.log(`Ready: ${resolve(target)}\nRun npm start, npm run build, or npm test from that directory.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
