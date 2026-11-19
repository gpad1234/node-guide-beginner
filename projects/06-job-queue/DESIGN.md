# Event-Driven Job Queue Design

## Status

This is the target design for Project 6. The scaffold contains a basic
`JobQueue` implementation, but `src/index.ts` and the tests are placeholders.
The project steps extend the queue with abortable delays, per-job timeouts,
draining, and retries; this document defines the behavior those steps should
preserve.

## Purpose and scope

The queue runs asynchronous jobs in one Node.js process, limits how many run at
once, reports lifecycle events, and supports cancellation during shutdown. It
is a learning implementation of promise-based concurrency and cooperative
cancellation, not a durable or distributed task system.

### Goals

- Accept jobs in memory and start them in FIFO order, subject to a configurable
  concurrency limit.
- Give each job a stable queue-local ID and pass an `AbortSignal` to its
  handler.
- Emit typed start, success, and terminal-failure events.
- Allow callers to wait for all accepted work to settle and to shut the queue
  down cleanly.
- Support optional per-job timeouts and retries with exponential backoff.

### Non-goals

- Persisting jobs across process restarts or sharing work between processes.
- Exactly-once execution, deduplication, or transactional side effects.
- Priorities, pause/resume, job removal, dependency graphs, or rate limiting.
- A web service, worker-thread pool, or external broker.
- Forcibly terminating a job that ignores its abort signal.

## Queue contract

The queue is created with a positive integer concurrency limit; the default is
`2`. `add(name, run, options?)` assigns and returns the next ID, queues the
job, and starts available work without waiting for the handler to finish.
Adding a job after shutdown throws synchronously.

A job handler has the form `(signal: AbortSignal) => Promise<T>`. It must
cooperate with cancellation by observing the signal in long-running work and
rejecting or settling promptly when aborted. The queue cannot stop a JavaScript
promise or arbitrary work by force.

Per-job options:

| Option | Contract |
| --- | --- |
| `timeoutMs` | Optional positive integer deadline for each attempt. If omitted, the attempt has no per-job timeout. |
| `retries` | Optional non-negative integer number of retries after the initial attempt. Defaults to `0`. |

Invalid concurrency, timeout, or retry values are rejected before the affected
job is accepted. A retry limit of `n` means at most `n + 1` attempts.

## Lifecycle and scheduling

Each accepted job moves through these states:

```text
pending -> running -> succeeded
                   -> waiting to retry -> running
                   -> failed
```

- Pending jobs start in FIFO order while fewer than `concurrency` jobs are
  active.
- The concurrency limit applies to handler attempts, not retry delays. When an
  attempt fails and will be retried, its slot is released during backoff; the
  retry re-enters the pending queue at the tail.
- IDs start at `1` for each queue instance and increase monotonically. An ID is
  not reused during that instance's lifetime.
- The queue retains no history after a job reaches a terminal state; callers
  that need results or history should collect the events themselves.

## Events

The public event contract is:

| Event | Payload | Meaning |
| --- | --- | --- |
| `job:started` | `(id)` | An attempt is about to invoke the handler. Emitted once per attempt, so a retried job can emit it multiple times. |
| `job:done` | `(id, result)` | The handler succeeded. Emitted once per job, with the final successful result. |
| `job:failed` | `(id, error)` | The job reached a terminal failure, including exhausting retries or an active attempt being aborted by shutdown. The payload is always an `Error`. |

Intermediate failures that will be retried do not emit `job:failed`. A queued
job discarded during shutdown never started and emits no lifecycle event.
Rejected non-`Error` values are normalized to `Error` before being emitted.
The existing typed `EventEmitter` event names and payloads remain the public
API; a wrong event name or payload should fail TypeScript compilation.

## Timeouts, cancellation, and retries

Each attempt receives a signal combining the queue's shutdown signal with its
own optional timeout signal (for example, with `AbortSignal.any`). A job's
`sleep(ms, signal)` helper must clear its timer and reject when aborted; it
must also reject immediately if passed an already-aborted signal.

A timeout is an attempt failure and may be retried. Shutdown cancellation is
not retried. For a job configured with `retries: n`, retry delays are
exponential: `100 * 2^k` milliseconds before retry number `k + 1`, starting
with `k = 0`. After the last attempt fails, the queue emits `job:failed`.
Failed attempts release their active slot before the delay, allowing other
pending work to proceed.

Timeouts and cancellation are cooperative. A handler that ignores its signal
can continue running after its timeout or prevent shutdown from completing;
the queue does not pretend otherwise.

## Waiting and shutdown

`drain()` returns a promise that resolves when the queue has no pending jobs,
active attempts, or scheduled retries. If new jobs are added before the queue
becomes idle, they are included in that wait. It does not close the queue.

`shutdown()` is idempotent and performs these steps:

1. Mark the queue closed so no more work can be accepted or started.
2. Discard pending jobs and cancel retry delays.
3. Abort the shared queue signal so active handlers can stop cooperatively.
4. Wait for active attempts to settle, then resolve.

Active attempts that reject because of shutdown emit their terminal
`job:failed` event. `shutdown()` waits for actual settlement, not just for the
abort request. A non-cooperative handler can therefore delay shutdown
indefinitely.

The demo in `src/index.ts` registers a `SIGINT` handler that calls
`shutdown()`. It should avoid starting a second shutdown sequence on repeated
signals and should exit only after the returned promise settles.

## Components

```text
src/index.ts  ->  src/queue.ts
      |                 |
 demo jobs          scheduling, state,
 + SIGINT           cancellation, events
      |
src/jobs.ts (recommended)  ->  abortable sleep and sample handlers
```

- **`src/queue.ts`** owns IDs, pending work, active attempts, retry timers,
  state transitions, event emission, `drain()`, and `shutdown()`. It does not
  know what a particular job does.
- **`src/jobs.ts`** (add this file while completing the project) contains the
  abortable `sleep` helper and small sample handlers. Keeping these separate
  makes them testable without running the demo.
- **`src/index.ts`** wires the queue to sample jobs, logs events, and handles
  `SIGINT`. It should not implement queue scheduling itself.
- **`test/queue.test.ts`** verifies scheduling and lifecycle behavior with
  controlled promises and short delays; tests should not rely on arbitrary
  long wall-clock sleeps.

The queue is entirely in memory. Restarting the process loses pending jobs,
active work, and event history.

## Failure behavior

| Condition | Result |
| --- | --- |
| Concurrency is not a positive integer | Constructor throws `RangeError` |
| Timeout or retry count is invalid | `add` throws before accepting the job |
| `add` is called after shutdown | Throws `Error`; no ID is consumed and no event is emitted |
| Handler rejects or throws a non-`Error` value | Retry if configured; otherwise emit `job:failed` with an `Error` |
| Attempt times out | Abort its signal; treat as an attempt failure and retry if allowed |
| Queue shuts down with pending jobs | Discard them without starting or emitting events |
| Queue shuts down with active jobs | Abort their signals, wait for settlement, and do not retry |
| Handler ignores cancellation | Continue waiting; do not report shutdown complete while it is active |

## Verification plan

The project is complete when these behaviors are covered:

1. The default and configured concurrency limits are respected; a test measures
   active handlers and proves the maximum never exceeds the limit.
2. Jobs start FIFO, get distinct increasing IDs, and emit the documented event
   payloads in the expected order.
3. A rejected job reports an `Error`; configured retries use the expected
   exponential delay, and success after retry emits `job:done` only once.
4. A timeout aborts the attempt signal and is eligible for retry; shutdown
   cancellation is not retried.
5. `sleep` resolves after its delay and rejects promptly on abort, including
   when its signal was already aborted.
6. `drain()` waits for active jobs and retries, then resolves when idle without
   closing the queue.
7. `shutdown()` rejects new work, drops pending work, aborts active work,
   waits for it to settle, and is safe to call more than once.
8. A handler that ignores cancellation keeps shutdown pending until it settles.
9. TypeScript accepts the declared events and rejects unknown event names.

Run `npm run build` and `npm test` from `projects/06-job-queue`. The scaffold's
`starter.test.ts` is a TODO placeholder, not a completed test suite.
