import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CreditCard, Plus, ReceiptText } from "lucide-react";
import { createOpenBackend, type DocumentRecord } from "@openbackend/sdk-js";
import "./styles.css";

type Product = {
  name: string;
  price: number;
};

type Sale = {
  item: string;
  total: number;
  createdAt: string;
};

function PosKiosk() {
  const [apiKey, setApiKey] = useState(() => {
    return new URLSearchParams(window.location.search).get("apiKey") ?? localStorage.getItem("openbackend.pos.apiKey") ?? "";
  });
  const [products, setProducts] = useState<Array<DocumentRecord<Product>>>([]);
  const [sales, setSales] = useState<Array<DocumentRecord<Sale>>>([]);
  const [name, setName] = useState("Coffee");
  const [price, setPrice] = useState("4.50");
  const app = useMemo(() => createOpenBackend({ url: "http://localhost:8787", apiKey }), [apiKey]);
  const db = useMemo(() => app.database(), [app]);

  const productStore = useMemo(() => db.collection<Product>("products"), [db]);
  const saleStore = useMemo(() => db.collection<Sale>("sales"), [db]);

  useEffect(() => productStore.watch(setProducts), [productStore]);
  useEffect(() => saleStore.watch(setSales), [saleStore]);

  const addProduct = async () => {
    localStorage.setItem("openbackend.pos.apiKey", apiKey);
    await productStore.create({ name, price: Number(price) });
  };

  const sell = async (product: Product) => {
    localStorage.setItem("openbackend.pos.apiKey", apiKey);
    await saleStore.create({
      item: product.name,
      total: product.price,
      createdAt: new Date().toISOString()
    });
  };

  const total = sales.reduce((sum, sale) => sum + sale.data.total, 0);

  return (
    <main>
      <header>
        <div>
          <h1>POS Kiosk</h1>
          <p>Local-first checkout demo powered by OpenBackend.</p>
        </div>
        <strong>${total.toFixed(2)}</strong>
      </header>

      <section className="composer">
        <input
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Device API key"
        />
        <input value={name} onChange={(event) => setName(event.target.value)} />
        <input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" />
        <button onClick={addProduct}><Plus size={18} /> Add</button>
      </section>

      <section className="layout">
        <div>
          <h2><CreditCard size={20} /> Products</h2>
          <div className="tiles">
            {products.map((product) => (
              <button key={product.id} className="tile" onClick={() => sell(product.data)}>
                <span>{product.data.name}</span>
                <strong>${product.data.price.toFixed(2)}</strong>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2><ReceiptText size={20} /> Recent Sales</h2>
          <ol>
            {sales.slice(0, 8).map((sale) => (
              <li key={sale.id}>
                <span>{sale.data.item}</span>
                <strong>${sale.data.total.toFixed(2)}</strong>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<PosKiosk />);
