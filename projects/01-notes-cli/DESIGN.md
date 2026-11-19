# Notes CLI Design

## Status

This is the implementation design for Project 1 in the learning guide. The
scaffold is intentionally incomplete: `add` and `list` are implemented, while
`done`, `delete`, robust input validation, and automated tests are exercises.
Use this document as the target behavior when completing the project.

## Purpose and scope

The Notes CLI is a small, local command-line tool for capturing short notes and
tracking whether each one is complete. It is intended to teach command-line
argument handling, TypeScript types, asynchronous file I/O, error handling, and
tests without introducing a database or third-party runtime dependency.

### Goals

- Add, list, complete, and delete notes from a terminal.
- Persist notes between runs in a JSON file.
- Give useful, predictable output and a non-zero exit code for invalid commands,
  invalid arguments, missing notes, or storage failures.
- Keep the implementation small enough to understand and test by a beginner.

### Non-goals

- Multiple users, synchronization, or safe concurrent writes from multiple
  processes.
- Search, tags, priorities, editing note text, undo, or bulk operations.
- Encryption, cloud backup, or a database migration mechanism.
- A published or globally installed package; packaging is a later project.

## User interface

Run commands from the project directory with `npm start -- ...`. The `--`
separator tells npm to pass the remaining arguments to the program.

| Command | Behavior | Successful output |
| --- | --- | --- |
| `add <text>` | Trim and add the supplied text as an incomplete note. Arguments after `add` are joined with spaces. | `Added note <id>` |
| `list` | Show notes in ascending ID order, with completion state. | `[ ] <id>: <text>` or `[x] <id>: <text>` per note |
| `done <id>` | Mark the matching note complete. Repeating the command is successful and leaves it complete. | `Completed note <id>` |
| `delete <id>` | Permanently remove the matching note. | `Deleted note <id>` |

An empty `list` prints `No notes yet.` and succeeds. Usage and operation errors
go to stderr; successful command output goes to stdout. Every invalid command or
argument, including a non-positive, non-integer, or unknown note ID, exits with
code `1`. Successful commands exit with code `0`. No unsuccessful command
prints a success message.

`add` rejects text that is empty after trimming. `done` and `delete` each
require exactly one ID argument; IDs must be positive safe integers. Extra or
missing arguments are usage errors.

## Data model

The persistent note format is a JSON array:

```ts
interface Note {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
}
```

- `id` is a positive integer unique among the notes currently stored.
- A new ID is one greater than the greatest current ID (or `1` when empty).
  Because no separate ID counter is stored, deleting the greatest ID can allow
  that ID to be used again.
- `text` is non-empty, trimmed UTF-8 text.
- `done` starts as `false`; `done <id>` changes it to `true`.
- `createdAt` is the creation time in ISO 8601 UTC format. Completion does not
  change it.

The store must reject malformed JSON and JSON that is not an array of notes
with the fields and types above. It must report a clear error and must not treat
invalid data as an empty notes file or overwrite it.

## Components and responsibilities

```text
src/index.ts  ->  src/store.ts  ->  notes.json
      |                 |
  CLI contract       JSON I/O and validation
      |
src/types.ts  ->  shared Note shape
```

- **`src/index.ts`** parses `process.argv`, validates command arguments,
  dispatches commands, performs note operations, and selects the exit code.
  It prints user-facing messages and formats list output. It does not read or
  write files directly.
- **`src/store.ts`** resolves the data-file path, loads and validates the JSON,
  and saves the complete note array. It propagates read/write errors so the
  entry point can report failure.
- **`src/types.ts`** defines the shared `Note` interface. Runtime file contents
  still need validation; a TypeScript type assertion is not a runtime check.
- **`test/`** verifies store behavior with an isolated temporary file and CLI
  behavior where practical. Tests must not depend on a developer's real
  `notes.json`.

## Persistence

By default, the data file is `notes.json` in the process's current working
directory. `NOTES_FILE` overrides the path; a relative override is also
resolved from the current working directory. The selected path is fixed when
the store module loads, so tests that configure `NOTES_FILE` must do so before
importing the store.

The first successful `add` creates the file. `list` on a missing file behaves
as an empty list and does not create a file. Mutations load the current array,
apply one operation, and save it. A failure to read or save is a failed command,
reported to stderr with exit code `1`; the CLI must not imply that the change
succeeded.

This design assumes one command process at a time. Two concurrent mutations
can overwrite one another; preventing that is outside this project's scope.

## Error behavior

| Condition | Result |
| --- | --- |
| Unknown command or wrong number of arguments | Print usage to stderr; exit `1`; leave data unchanged |
| Blank text or invalid ID syntax | Explain the invalid argument; exit `1`; leave data unchanged |
| Well-formed ID does not exist | Report `Note <id> not found`; exit `1`; leave data unchanged |
| Missing data file | Treat as an empty array |
| Malformed JSON or invalid note shape | Report that the notes file is invalid and identify its path; exit `1`; preserve the file |
| Permission, disk, or other file-system error | Report the operation and path with the underlying error message; exit `1` |

Expected input and storage errors should be concise and actionable, not a raw
stack trace. Errors must not be silently converted into empty data or success.

## Verification plan

The implementation is complete when these behaviors are covered and pass:

1. Adding trimmed text creates a note with the next ID, `done: false`, and an
   ISO timestamp; the saved JSON survives a subsequent load.
2. Listing an empty store succeeds; listing notes shows stable ascending IDs
   and the correct `[ ]` / `[x]` marker.
3. Completing an existing note persists `done: true`; completing it twice is
   still successful.
4. Deleting an existing note removes it from the saved data.
5. Blank text, malformed IDs, unknown IDs, unknown commands, and wrong argument
   counts fail without changing the saved notes.
6. A missing file loads as empty, while malformed JSON and invalid note shapes
   fail without overwriting the source file.
7. Tests use a temporary file and do not read or modify a user's notes.

Run `npm run build` and `npm test` from `projects/01-notes-cli`. The scaffold's
initial `starter.test.ts` is a TODO placeholder, not evidence that these
behaviors have been tested.
