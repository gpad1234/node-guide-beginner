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
