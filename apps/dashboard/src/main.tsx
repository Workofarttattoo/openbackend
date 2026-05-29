import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Box, Database, Download, FileArchive, Play, Plus, RefreshCw, Trash2, Upload, Users } from "lucide-react";
import { createOpenBackend, type DocumentRecord } from "@openbackend/sdk-js";
import "./styles.css";

const backendUrl = "http://localhost:8787";

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("openbackend.token") ?? "");
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [collection, setCollection] = useState("products");
  const [documents, setDocuments] = useState<Array<DocumentRecord<Record<string, unknown>>>>([]);
  const [users, setUsers] = useState<Array<unknown>>([]);
  const [apiKeys, setApiKeys] = useState<Array<unknown>>([]);
  const [files, setFiles] = useState<Array<unknown>>([]);
  const [functions, setFunctions] = useState<Array<string>>([]);
  const [draft, setDraft] = useState('{"name":"Coffee","price":4.5}');
  const [userEmail, setUserEmail] = useState("owner@example.local");
  const [userPassword, setUserPassword] = useState("change-me-now");
  const [apiKeyLabel, setApiKeyLabel] = useState("pos-kiosk");
  const [newApiKey, setNewApiKey] = useState("");
  const [importJson, setImportJson] = useState("");
  const [status, setStatus] = useState("Ready");
  const client = useMemo(() => createOpenBackend({ url: backendUrl, token }), [token]);
  const db = useMemo(() => client.database(), [client]);

  useEffect(() => {
    void client.auth().bootstrapStatus().then((result) => setBootstrapRequired(result.required));
  }, [client]);

  const refresh = async () => {
    const [items, userList, apiKeyList, fileList, functionList] = await Promise.all([
      db.collection<Record<string, unknown>>(collection).list(),
      fetchJson<Array<unknown>>("/api/admin/auth/users", token),
      fetchJson<Array<unknown>>("/api/admin/auth/api-keys", token),
      fetchJson<Array<unknown>>("/api/files", token),
      fetchJson<Array<string>>("/api/functions", token)
    ]);

    setDocuments(items);
    setUsers(userList);
    setApiKeys(apiKeyList);
    setFiles(fileList);
    setFunctions(functionList);
  };

  useEffect(() => {
    const stop = db.collection<Record<string, unknown>>(collection).watch(setDocuments);
    void refresh();
    return stop;
  }, [collection]);

  const createDocument = async () => {
    await db.collection(collection).create(JSON.parse(draft));
    setStatus("Document created");
    await refresh();
  };

  const runFunction = async (name: string) => {
    const result = await client.functions().run(name, { source: "dashboard" });
    setStatus(JSON.stringify(result));
  };

  const createUser = async () => {
    await client.auth().createUser(userEmail, userPassword);
    setStatus("User created");
    await refresh();
  };

  const createApiKey = async () => {
    const result = await postJson<{ key: string }>("/api/admin/auth/api-keys", { label: apiKeyLabel }, token);
    setNewApiKey(result.key);
    setStatus("API key created");
    await refresh();
  };

  const authenticate = async () => {
    const result = bootstrapRequired
      ? await client.auth().bootstrap(userEmail, userPassword)
      : await client.auth().login(userEmail, userPassword);
    const sessionToken = readSessionToken(result);
    localStorage.setItem("openbackend.token", sessionToken);
    setToken(sessionToken);
    setBootstrapRequired(false);
    setStatus(bootstrapRequired ? "Admin bootstrapped" : "Logged in");
  };

  const exportData = async () => {
    const response = await fetch(`${backendUrl}/api/admin/export`, {
      headers: authHeaders(token)
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "openbackend-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = async () => {
    const payload = JSON.parse(importJson);
    const result = await postJson<{ importedDocuments: number }>("/api/admin/import", payload, token);
    setStatus(`Imported ${result.importedDocuments} documents`);
    setImportJson("");
    await refresh();
  };

  const deleteFile = async (id: string) => {
    await fetch(`${backendUrl}/api/files/${id}`, {
      method: "DELETE",
      headers: authHeaders(token)
    });
    setStatus("File deleted");
    await refresh();
  };

  if (!token) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="brand">
            <Box size={26} />
            <strong>OpenBackend</strong>
          </div>
          <h1>{bootstrapRequired ? "Bootstrap Admin" : "Admin Login"}</h1>
          <label>
            Email
            <input value={userEmail} onChange={(event) => setUserEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input
              value={userPassword}
              onChange={(event) => setUserPassword(event.target.value)}
              type="password"
            />
          </label>
          <button onClick={authenticate}><Users size={18} /> Continue</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Box size={26} />
          <strong>OpenBackend</strong>
        </div>
        <button className="nav-item active"><Database size={18} /> Collections</button>
        <button className="nav-item"><Users size={18} /> Users</button>
        <button className="nav-item"><FileArchive size={18} /> Files</button>
        <button className="nav-item"><Play size={18} /> Functions</button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Local Admin</h1>
            <p>{status}</p>
          </div>
          <div className="actions">
            <button onClick={refresh} title="Refresh"><RefreshCw size={18} /></button>
            <button onClick={exportData} title="Export data">
              <Download size={18} />
            </button>
          </div>
        </header>

        <section className="toolbar">
          <label>
            Collection
            <input value={collection} onChange={(event) => setCollection(event.target.value)} />
          </label>
          <label className="wide">
            JSON document
            <input value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <button onClick={createDocument}><Plus size={18} /> Create</button>
        </section>

        <section className="toolbar">
          <label>
            User email
            <input value={userEmail} onChange={(event) => setUserEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input
              value={userPassword}
              onChange={(event) => setUserPassword(event.target.value)}
              type="password"
            />
          </label>
          <button onClick={createUser}><Plus size={18} /> User</button>
        </section>

        <section className="toolbar">
          <label>
            API key label
            <input value={apiKeyLabel} onChange={(event) => setApiKeyLabel(event.target.value)} />
          </label>
          <button onClick={createApiKey}><Plus size={18} /> API Key</button>
          {newApiKey && <code className="secret-output">{newApiKey}</code>}
        </section>

        <section className="toolbar">
          <label className="wide">
            Import JSON
            <input
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              placeholder='{"database":{"documents":[]}}'
            />
          </label>
          <button onClick={importData} disabled={!importJson.trim()}><Upload size={18} /> Import</button>
        </section>

        <section className="grid">
          <Panel title="Documents" count={documents.length}>
            <Table rows={documents.map((item) => ({ id: item.id, ...item.data, rev: item.revision }))} />
          </Panel>
          <Panel title="Users" count={users.length}>
            <Table rows={users as Array<Record<string, unknown>>} />
          </Panel>
          <Panel title="API Keys" count={apiKeys.length}>
            <Table rows={apiKeys as Array<Record<string, unknown>>} />
          </Panel>
          <Panel title="Files" count={files.length}>
            <Table
              rows={files as Array<Record<string, unknown>>}
              action={(row) => (
                <button className="row-action" onClick={() => deleteFile(String(row.id))} title="Delete file">
                  <Trash2 size={15} />
                </button>
              )}
            />
          </Panel>
          <Panel title="Functions" count={functions.length}>
            <div className="function-list">
              {functions.map((name) => (
                <button key={name} onClick={() => runFunction(name)}>
                  <Play size={16} /> {name}
                </button>
              ))}
            </div>
          </Panel>
        </section>
      </section>
    </main>
  );
}

function Panel(props: { title: string; count: number; children: React.ReactNode }) {
  return (
    <article className="panel">
      <header>
        <h2>{props.title}</h2>
        <span>{props.count}</span>
      </header>
      {props.children}
    </article>
  );
}

function Table({
  rows,
  action
}: {
  rows: Array<Record<string, unknown>>;
  action?: (row: Record<string, unknown>) => React.ReactNode;
}) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 5);

  if (rows.length === 0) {
    return <p className="empty">No records yet.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => <th key={column}>{column}</th>)}
          {action && <th></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={String(row.id ?? index)}>
            {columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}
            {action && <td>{action(row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    headers: authHeaders(token)
  });
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });
  return response.json() as Promise<T>;
}

function authHeaders(token: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

function readSessionToken(result: unknown): string {
  const record = result as { token?: string; session?: { token?: string } };
  const token = record.token ?? record.session?.token;
  if (!token) {
    throw new Error("Session token missing from auth response");
  }

  return token;
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
