export type OpenBackendOptions = {
  url: string;
  token?: string;
  apiKey?: string;
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

export type StoredObject = {
  id: string;
  name: string;
  path: string;
  size: number;
  contentType: string;
  createdAt: string;
};

export type AuthSession = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type AuthResult = {
  user?: unknown;
  session?: AuthSession;
  token?: string;
};

export function createOpenBackend(options: OpenBackendOptions): OpenBackendClient {
  return new OpenBackendClient(options);
}

export class OpenBackendClient {
  #url: string;
  #auth: AuthHeaders;

  constructor(options: OpenBackendOptions) {
    this.#url = options.url.replace(/\/$/, "");
    this.#auth = {
      token: options.token,
      apiKey: options.apiKey
    };
  }

  setToken(token: string): this {
    this.#auth.token = token;
    return this;
  }

  setApiKey(apiKey: string): this {
    this.#auth.apiKey = apiKey;
    return this;
  }

  clearAuth(): this {
    delete this.#auth.token;
    delete this.#auth.apiKey;
    return this;
  }

  database(): DatabaseClient {
    return new DatabaseClient(this.#url, this.#auth);
  }

  auth(): AuthClient {
    return new AuthClient(this.#url, this.#auth);
  }

  storage(): StorageClient {
    return new StorageClient(this.#url, this.#auth);
  }

  functions(): FunctionsClient {
    return new FunctionsClient(this.#url, this.#auth);
  }
}

export class DatabaseClient {
  #url: string;
  #auth: AuthHeaders;

  constructor(url: string, auth: AuthHeaders) {
    this.#url = url;
    this.#auth = auth;
  }

  collection<T = unknown>(name: string): CollectionClient<T> {
    return new CollectionClient<T>(this.#url, name, this.#auth);
  }
}

export class CollectionClient<T = unknown> {
  #url: string;
  #name: string;
  #auth: AuthHeaders;

  constructor(url: string, name: string, auth: AuthHeaders) {
    this.#url = url;
    this.#name = name;
    this.#auth = auth;
  }

  async list(): Promise<Array<DocumentRecord<T>>> {
    return request(`${this.#url}/api/collections/${this.#name}/documents`, {}, this.#auth);
  }

  async create(data: T): Promise<DocumentRecord<T>> {
    return request(`${this.#url}/api/collections/${this.#name}/documents`, {
      method: "POST",
      body: JSON.stringify({ data })
    }, this.#auth);
  }

  async update(id: string, patch: Partial<T>): Promise<DocumentRecord<T>> {
    return request(`${this.#url}/api/collections/${this.#name}/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ data: patch })
    }, this.#auth);
  }

  async remove(id: string): Promise<DocumentRecord<T>> {
    return request(`${this.#url}/api/collections/${this.#name}/documents/${id}`, {
      method: "DELETE"
    }, this.#auth);
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
  #auth: AuthHeaders;

  constructor(url: string, auth: AuthHeaders) {
    this.#url = url;
    this.#auth = auth;
  }

  createUser(email: string, password: string): Promise<unknown> {
    return request(`${this.#url}/api/admin/auth/users`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    }, this.#auth);
  }

  login(email: string, password: string): Promise<AuthSession> {
    return request(`${this.#url}/api/auth/sessions`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  bootstrap(email: string, password: string): Promise<AuthResult> {
    return request(`${this.#url}/api/auth/bootstrap`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  bootstrapStatus(): Promise<{ required: boolean }> {
    return request(`${this.#url}/api/auth/bootstrap`);
  }
}

export class StorageClient {
  #url: string;
  #auth: AuthHeaders;

  constructor(url: string, auth: AuthHeaders) {
    this.#url = url;
    this.#auth = auth;
  }

  list(): Promise<StoredObject[]> {
    return request(`${this.#url}/api/files`, {}, this.#auth);
  }

  upload(name: string, data: string, contentType = "text/plain"): Promise<StoredObject> {
    return request(`${this.#url}/api/files`, {
      method: "POST",
      body: JSON.stringify({ name, data, contentType, encoding: "utf8" })
    }, this.#auth);
  }

  async download(id: string): Promise<Blob> {
    const response = await fetch(`${this.#url}/api/files/${id}`, {
      headers: authHeaders(this.#auth)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.blob();
  }

  remove(id: string): Promise<StoredObject> {
    return request(`${this.#url}/api/files/${id}`, {
      method: "DELETE"
    }, this.#auth);
  }
}

export class FunctionsClient {
  #url: string;
  #auth: AuthHeaders;

  constructor(url: string, auth: AuthHeaders) {
    this.#url = url;
    this.#auth = auth;
  }

  run(name: string, body?: unknown): Promise<unknown> {
    return request(`${this.#url}/api/functions/${name}`, {
      method: "POST",
      body: JSON.stringify(body ?? {})
    }, this.#auth);
  }
}

type AuthHeaders = {
  token?: string;
  apiKey?: string;
};

async function request<T>(url: string, init: RequestInit = {}, auth: AuthHeaders = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeaders(auth),
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

function authHeaders(auth: AuthHeaders): Record<string, string> {
  const headers: Record<string, string> = {};
  if (auth.token) {
    headers.authorization = `Bearer ${auth.token}`;
  }

  if (auth.apiKey) {
    headers["x-openbackend-api-key"] = auth.apiKey;
  }

  return headers;
}
