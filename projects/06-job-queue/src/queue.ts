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
