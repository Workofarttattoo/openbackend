export type FunctionContext = {
  body: unknown;
  headers: Record<string, string>;
};

export type LocalFunction = (context: FunctionContext) => unknown | Promise<unknown>;

export class FunctionRegistry {
  #functions = new Map<string, LocalFunction>();

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

    return fn(context);
  }
}

