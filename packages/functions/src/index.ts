export type FunctionContext = {
  body: unknown;
  headers: Record<string, string>;
};

export type LocalFunction = (context: FunctionContext) => unknown | Promise<unknown>;

export class FunctionRegistry {
  #functions = new Map<string, LocalFunction>();
  #timeoutMs: number;

  constructor(options: { timeoutMs?: number } = {}) {
    this.#timeoutMs = options.timeoutMs ?? 5000;
  }

  register(name: string, fn: LocalFunction): void {
    this.#functions.set(name, fn);
  }

  list(): string[] {
    return [...this.#functions.keys()].sort();
  }

  async run(name: string, context: FunctionContext): Promise<unknown> {
    const fn = this.#functions.get(name);
    if (!fn) {
      throw new Error(`Function not found: ${name}`);
    }

    return Promise.race([
      fn(context),
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error(`Function timed out after ${this.#timeoutMs}ms`)), this.#timeoutMs);
      })
    ]);
  }
}
