import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileText, Mail, Plus, RefreshCw } from "lucide-react";
import { createOpenBackend, type DocumentRecord } from "@openbackend/sdk-js";
import "./styles.css";

type Post = {
  title: string;
  status: string;
  body: string;
};

type ContactMessage = {
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

const backendUrl = "http://localhost:8787";

function WebsiteExample() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("openbackend.website.apiKey") ?? "");
  const [posts, setPosts] = useState<Array<DocumentRecord<Post>>>([]);
  const [title, setTitle] = useState("Launch note");
  const [body, setBody] = useState("OpenBackend is running locally for this website build.");
  const [contact, setContact] = useState({ name: "Client Lead", email: "lead@example.local", message: "Tell me more." });
  const [status, setStatus] = useState("Ready");

  const publicApp = useMemo(() => createOpenBackend({ url: backendUrl }), []);
  const writeApp = useMemo(() => createOpenBackend({ url: backendUrl, apiKey }), [apiKey]);
  const publicPosts = useMemo(() => publicApp.database().collection<Post>("website_posts"), [publicApp]);
  const writePosts = useMemo(() => writeApp.database().collection<Post>("website_posts"), [writeApp]);
  const messages = useMemo(() => writeApp.database().collection<ContactMessage>("contact_messages"), [writeApp]);

  useEffect(() => publicPosts.watch(setPosts), [publicPosts]);

  const publishPost = async () => {
    rememberApiKey(apiKey);
    await writePosts.create({ title, body, status: "published" });
    setStatus("Post published");
  };

  const sendContact = async () => {
    rememberApiKey(apiKey);
    await messages.create({
      ...contact,
      createdAt: new Date().toISOString()
    });
    setStatus("Contact message saved");
  };

  const refresh = async () => {
    setPosts(await publicPosts.list());
    setStatus("Refreshed");
  };

  return (
    <main>
      <header>
        <div>
          <h1>Website Build Backend</h1>
          <p>{status}</p>
        </div>
        <button onClick={refresh} title="Refresh"><RefreshCw size={18} /></button>
      </header>

      <section className="api-strip">
        <label>
          Website API key
          <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="ob_..." />
        </label>
      </section>

      <section className="layout">
        <article className="panel">
          <h2><FileText size={20} /> Content</h2>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            Body
            <textarea value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <button onClick={publishPost}><Plus size={18} /> Publish</button>
        </article>

        <article className="panel">
          <h2><Mail size={20} /> Contact Form</h2>
          <label>
            Name
            <input value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} />
          </label>
          <label>
            Email
            <input value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} />
          </label>
          <label>
            Message
            <textarea
              value={contact.message}
              onChange={(event) => setContact({ ...contact, message: event.target.value })}
            />
          </label>
          <button onClick={sendContact}><Plus size={18} /> Submit</button>
        </article>
      </section>

      <section>
        <h2><FileText size={20} /> Published Posts</h2>
        <div className="posts">
          {posts.map((post) => (
            <article key={post.id} className="post">
              <span>{post.data.status}</span>
              <h3>{post.data.title}</h3>
              <p>{post.data.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function rememberApiKey(apiKey: string): void {
  if (apiKey) {
    localStorage.setItem("openbackend.website.apiKey", apiKey);
  }
}

createRoot(document.getElementById("root") as HTMLElement).render(<WebsiteExample />);

