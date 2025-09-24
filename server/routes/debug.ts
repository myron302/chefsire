// server/routes/debug.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

/** Simple DB ping via storage */
r.get("/debug/ping-db", async (_req, res) => {
  try {
    const u = await storage.getUser("user-4").catch(() => undefined);
    res.json({ ok: true, sampleUserFound: !!u });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** Add one pantry item via GET query */
r.get("/debug/add-pantry", async (req, res) => {
  try {
    const userId = String(req.query.userId || "user-4");
    const name = String(req.query.name || "Olive Oil");
    const category = String(req.query.category || "ingredients");
    const quantity = Number(req.query.quantity || 1);
    const unit = String(req.query.unit || "bottle");
    const notes = String(req.query.notes || "extra-virgin");
    const item = await storage.addPantryItem(userId, { name, category, quantity, unit, notes });
    res.json({ ok: true, item });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** Add a demo product via GET query */
r.get("/debug/add-product", async (req, res) => {
  try {
    const sellerId = String(req.query.sellerId || "user-4");
    const name = String(req.query.name || "Handmade Pasta Kit");
    const price = String(req.query.price || "24.99");
    const product = await storage.createProduct({
      sellerId,
      name,
      description: String(req.query.description || "Flour + semolina + instructions"),
      price,
      category: String(req.query.category || "ingredients"),
      images: [
        String(
          req.query.image ||
            "https://images.unsplash.com/photo-1526318472351-c75fcf070305?w=800&auto=format&fit=crop"
        ),
      ],
      inventory: Number(req.query.inventory || 20),
      shippingEnabled: true,
      localPickupEnabled: false,
      isExternal: false,
      externalUrl: null as any,
      shippingCost: null as any,
      pickupLocation: null as any,
      pickupInstructions: null as any,
      isActive: true,
    } as any);
    res.json({ ok: true, product });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** One-click mini-seed for pantry + product */
r.get("/debug/seed-min", async (_req, res) => {
  try {
    const pantry = await storage.addPantryItem("user-4", {
      name: "Olive Oil",
      category: "ingredients",
      quantity: 1,
      unit: "bottle",
      notes: "extra-virgin",
    });
    const product = await storage.createProduct({
      sellerId: "user-4",
      name: "Handmade Pasta Kit",
      description: "Flour + semolina + instructions",
      price: "24.99",
      category: "ingredients",
      images: [
        "https://images.unsplash.com/photo-1526318472351-c75fcf070305?w=800&auto=format&fit=crop",
      ],
      inventory: 20,
      shippingEnabled: true,
      localPickupEnabled: false,
      isExternal: false,
      externalUrl: null as any,
      shippingCost: null as any,
      pickupLocation: null as any,
      pickupInstructions: null as any,
      isActive: true,
    } as any);
    res.json({ ok: true, pantry, product });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/** Tiny browser panel so you can click to seed/test */
r.get("/debug/panel", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Chefsire Debug Panel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, sans-serif; padding: 16px; max-width: 920px; margin: 0 auto; }
    h1 { margin: 0 0 12px; }
    section { border: 1px solid #ddd; border-radius: 10px; padding: 14px 16px; margin: 14px 0; }
    button { padding: 8px 12px; border-radius: 8px; border: 1px solid #bbb; background: #f9f9f9; cursor: pointer; }
    button:hover { background: #f1f1f1; }
    pre { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow: auto; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    input { padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; }
    .small { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>Chefsire Debug Panel</h1>

  <section>
    <h3>1) DB Ping</h3>
    <div class="row">
      <button onclick="hit('/api/debug/ping-db')">Ping DB</button>
    </div>
    <pre id="out1" class="small"></pre>
  </section>

  <section>
    <h3>2) Pantry (user-4)</h3>
    <div class="row">
      <input id="pName" placeholder="name" value="Olive Oil" />
      <input id="pCat" placeholder="category" value="ingredients" />
      <input id="pQty" placeholder="quantity" type="number" step="1" value="1" />
      <input id="pUnit" placeholder="unit" value="bottle" />
      <button onclick="addPantry()">Add Pantry Item</button>
      <a href="/api/users/user-4/pantry" target="_blank">View Pantry JSON</a>
    </div>
    <pre id="out2" class="small"></pre>
  </section>

  <section>
    <h3>3) Marketplace (user-4)</h3>
    <div class="row">
      <input id="mName" placeholder="name" value="Handmade Pasta Kit" />
      <input id="mPrice" placeholder="price" value="24.99" />
      <button onclick="addProduct()">Add Product</button>
      <a href="/api/marketplace/products?limit=5" target="_blank">View Products JSON</a>
    </div>
    <pre id="out3" class="small"></pre>
  </section>

  <section>
    <h3>4) Substitutions (GET)</h3>
    <div class="row">
      <input id="sIngr" placeholder="ingredients CSV" value="milk,butter" style="min-width:260px;" />
      <input id="sDiet" placeholder="diet (optional)" value="vegan" />
      <input id="sAvoid" placeholder="avoid CSV (optional)" value="dairy" />
      <button onclick="subs()">Suggest</button>
      <a id="subsLink" href="#" target="_blank">Open GET URL</a>
    </div>
    <pre id="out4" class="small"></pre>
  </section>

  <section>
    <h3>5) One-click Mini Seed</h3>
    <div class="row">
      <button onclick="hit('/api/debug/seed-min', 'out5')">Run mini-seed</button>
    </div>
    <pre id="out5" class="small"></pre>
  </section>

<script>
async function hit(path, outId = 'out1') {
  const el = document.getElementById(outId);
  el.textContent = 'Loading...';
  try {
    const res = await fetch(path);
    const data = await res.json();
    el.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    el.textContent = 'Error: ' + e;
  }
}

async function addPantry() {
  const name = encodeURIComponent(document.getElementById('pName').value);
  const category = encodeURIComponent(document.getElementById('pCat').value);
  const quantity = encodeURIComponent(document.getElementById('pQty').value);
  const unit = encodeURIComponent(document.getElementById('pUnit').value);
  const url = \`/api/debug/add-pantry?userId=user-4&name=\${name}&category=\${category}&quantity=\${quantity}&unit=\${unit}\`;
  hit(url, 'out2');
}

async function addProduct() {
  const name = encodeURIComponent(document.getElementById('mName').value);
  const price = encodeURIComponent(document.getElementById('mPrice').value);
  const url = \`/api/debug/add-product?sellerId=user-4&name=\${name}&price=\${price}\`;
  hit(url, 'out3');
}

function subs() {
  const ing = encodeURIComponent(document.getElementById('sIngr').value);
  const diet = encodeURIComponent(document.getElementById('sDiet').value);
  const avoid = encodeURIComponent(document.getElementById('sAvoid').value);
  const url = \`/api/substitutions/suggest?ingredients=\${ing}&diet=\${diet}&avoid=\${avoid}\`;
  document.getElementById('subsLink').href = url;
  hit(url, 'out4');
}
</script>
</body>
</html>`);
});

export default r;
