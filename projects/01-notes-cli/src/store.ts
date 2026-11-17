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
