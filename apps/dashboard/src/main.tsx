import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Box, Database, Download, FileArchive, Play, Plus, RefreshCw, Users } from "lucide-react";
import { createOpenBackend, type DocumentRecord } from "@openbackend/sdk-js";
import "./styles.css";

const client = createOpenBackend({ url: "http://localhost:8787" });

function App() {
  const [collection, setCollection] = useState("products");
  const [documents, setDocuments] = useState<Array<DocumentRecord<Record<string, unknown>>>>([]);
  const [users, setUsers] = useState<Array<unknown>>([]);
  const [files, setFiles] = useState<Array<unknown>>([]);
  const [functions, setFunctions] = useState<Array<string>>([]);
  const [draft, setDraft] = useState('{"name":"Coffee","price":4.5}');
  const [status, setStatus] = useState("Ready");
  const db = useMemo(() => client.database(), []);

  const refresh = async () => {
    const [items, userList, fileList, functionList] = await Promise.all([
      db.collection<Record<string, unknown>>(collection).list(),
      fetchJson<Array<unknown>>("/api/auth/users"),
      fetchJson<Array<unknown>>("/api/files"),
      fetchJson<Array<string>>("/api/functions")
    ]);

    setDocuments(items);
    setUsers(userList);
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
            <a className="icon-link" href="http://localhost:8787/api/export" title="Export data">
              <Download size={18} />
            </a>
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

        <section className="grid">
          <Panel title="Documents" count={documents.length}>
            <Table rows={documents.map((item) => ({ id: item.id, ...item.data, rev: item.revision }))} />
          </Panel>
          <Panel title="Users" count={users.length}>
            <Table rows={users as Array<Record<string, unknown>>} />
          </Panel>
          <Panel title="Files" count={files.length}>
            <Table rows={files as Array<Record<string, unknown>>} />
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

function Table({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 5);

  if (rows.length === 0) {
    return <p className="empty">No records yet.</p>;
  }

  return (
    <table>
      <thead>
        <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={String(row.id ?? index)}>
            {columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`http://localhost:8787${path}`);
  return response.json() as Promise<T>;
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);

