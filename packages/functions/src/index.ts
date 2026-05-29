import { Worker } from "node:worker_threads";

export type FunctionContext = {
  body: unknown;
  headers: Record<string, string>;
};

export type LocalFunction = (context: FunctionContext) => unknown | Promise<unknown>;
type FunctionEntry =
  | { mode: "local"; fn: LocalFunction }
  | { mode: "worker"; source: string };

export class FunctionRegistry {
  #functions = new Map<string, FunctionEntry>();
  #timeoutMs: number;

  constructor(options: { timeoutMs?: number } = {}) {
    this.#timeoutMs = options.timeoutMs ?? 5000;
  }

  register(name: string, fn: LocalFunction): void {
    this.#functions.set(name, { mode: "local", fn });
  }

  registerIsolated(name: string, source: string): void {
    this.#functions.set(name, { mode: "worker", source });
  }

  list(): string[] {
    return [...this.#functions.keys()].sort();
  }

  async run(name: string, context: FunctionContext): Promise<unknown> {
    const entry = this.#functions.get(name);
    if (!entry) {
      throw new Error(`Function not found: ${name}`);
    }

    if (entry.mode === "worker") {
      return runInWorker(entry.source, context, this.#timeoutMs);
    }

    return Promise.race([
      entry.fn(context),
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error(`Function timed out after ${this.#timeoutMs}ms`)), this.#timeoutMs);
      })
    ]);
  }
}

function runInWorker(source: string, context: FunctionContext, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      `
        const { parentPort, workerData } = require("node:worker_threads");
        const vm = require("node:vm");
        Promise.resolve()
          .then(() => {
            const sandbox = Object.freeze({
              console: Object.freeze({
                log: (...args) => parentPort.postMessage({ log: args.map(String).join(" ") }),
                error: (...args) => parentPort.postMessage({ log: args.map(String).join(" ") })
              })
            });
            const script = new vm.Script("(" + workerData.source + ")", {
              filename: "openbackend-function.vm.js"
            });
            const fn = script.runInNewContext(sandbox, {
              timeout: workerData.timeoutMs,
              contextCodeGeneration: {
                strings: false,
                wasm: false
              }
            });
            if (typeof fn !== "function") {
              throw new Error("Isolated function source must evaluate to a function");
            }
            return fn(workerData.context);
          })
          .then((result) => parentPort.postMessage({ ok: true, result }))
          .catch((error) => parentPort.postMessage({ ok: false, error: error.message }));
      `,
      {
        eval: true,
        resourceLimits: {
          maxOldGenerationSizeMb: 32,
          maxYoungGenerationSizeMb: 8,
          stackSizeMb: 2
        },
        workerData: {
          source,
          context: JSON.parse(JSON.stringify(context)),
          timeoutMs
        }
      }
    );

    const timeout = setTimeout(() => {
      void worker.terminate();
      reject(new Error(`Function timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    worker.on("message", (message: { ok?: boolean; result?: unknown; error?: string; log?: string }) => {
      if (message.log) {
        return;
      }

      clearTimeout(timeout);
      void worker.terminate();
      if (message.ok) {
        resolve(message.result);
        return;
      }

      reject(new Error(message.error ?? "Function failed"));
    });

    worker.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
