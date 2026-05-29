export type OpenBackendOptions = {
  url: string;
};

export type DocumentRecord<T = unknown> = {
  id: string;
  collection: string;
  data: T;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export function createOpenBackend(options: OpenBackendOptions): OpenBackendClient {
  return new OpenBackendClient(options.url);
}

export class OpenBackendClient {
  #url: string;

  constructor(url: string) {
    this.#url = url.replace(/\/$/, "");
  }

  database(): DatabaseClient {
    return new DatabaseClient(this.#url);
  }

  auth(): AuthClient {
    return new AuthClient(this.#url);
  }

  storage(): StorageClient {
    return new StorageClient(this.#url);
  }

  functions(): FunctionsClient {
    return new FunctionsClient(this.#url);
  }
}

export class DatabaseClient {
  #url: string;

  constructor(url: string) {
    this.#url = url;
  }

  collection<T = unknown>(name: string): CollectionClient<T> {
    return new CollectionClient<T>(this.#url, name);
  }
}

export class CollectionClient<T = unknown> {
  #url: string;
  #name: string;

  constructor(url: string, name: string) {
    this.#url = url;
    this.#name = name;
  }

  async list(): Promise<Array<DocumentRecord<T>>> {
    return request(`${this.#url}/api/collections/${this.#name}/documents`);
  }

  async create(data: T): Promise<DocumentRecord<T>> {
    return request(`${this.#url}/api/collections/${this.#name}/documents`, {
      method: "POST",
      body: JSON.stringify({ data })
    });
  }

  async update(id: string, patch: Partial<T>): Promise<DocumentRecord<T>> {
    return request(`${this.#url}/api/collections/${this.#name}/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ data: patch })
    });
  }

  async remove(id: string): Promise<DocumentRecord<T>> {
    return request(`${this.#url}/api/collections/${this.#name}/documents/${id}`, {
      method: "DELETE"
    });
  }

  watch(callback: (items: Array<DocumentRecord<T>>) => void): () => void {
    const socketUrl = this.#url.replace(/^http/, "ws");
    const socket = new WebSocket(`${socketUrl}/realtime`);
    let closed = false;

    const refresh = async () => {
      if (!closed) {
        callback(await this.list());
      }
    };

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ action: "watch", topic: `collections:${this.#name}` }));
      void refresh();
    });

    socket.addEventListener("message", () => {
      void refresh();
    });

    return () => {
      closed = true;
      socket.close();
    };
  }
}

export class AuthClient {
  #url: string;

  constructor(url: string) {
    this.#url = url;
  }

  createUser(email: string, password: string): Promise<unknown> {
    return request(`${this.#url}/api/auth/users`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  login(email: string, password: string): Promise<unknown> {
    return request(`${this.#url}/api/auth/sessions`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }
}

export class StorageClient {
  #url: string;

  constructor(url: string) {
    this.#url = url;
  }

  upload(name: string, data: string, contentType = "text/plain"): Promise<unknown> {
    return request(`${this.#url}/api/files`, {
      method: "POST",
      body: JSON.stringify({ name, data, contentType, encoding: "utf8" })
    });
  }
}

export class FunctionsClient {
  #url: string;

  constructor(url: string) {
    this.#url = url;
  }

  run(name: string, body?: unknown): Promise<unknown> {
    return request(`${this.#url}/api/functions/${name}`, {
      method: "POST",
      body: JSON.stringify(body ?? {})
    });
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

