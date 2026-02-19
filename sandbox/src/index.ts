import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();
const PORT = Number(process.env.PORT) || 3200;
const BUILD = process.env.CAPNET_BUILD ?? "dev";
const VENDOR = "sandboxmart"; // normalized, lowercase

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

app.use(
  cors({
    origin: [
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    ],
  })
);
app.use(express.json({ limit: "256kb" }));

// -----------------------------------------------------------------------------
// Catalog (deterministic, includes blocked categories for demo)
// -----------------------------------------------------------------------------

interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  in_stock: boolean;
}

const CATALOG: CatalogItem[] = [
  // Groceries (allowed)
  { sku: "GRO-001", name: "Organic Milk (1 gal)", category: "grocery", price_cents: 599, in_stock: true },
  { sku: "GRO-002", name: "Whole Wheat Bread", category: "grocery", price_cents: 349, in_stock: true },
  { sku: "GRO-003", name: "Free Range Eggs (12)", category: "grocery", price_cents: 499, in_stock: true },
  { sku: "GRO-004", name: "Organic Bananas (bunch)", category: "grocery", price_cents: 199, in_stock: true },
  { sku: "GRO-005", name: "Greek Yogurt (32oz)", category: "grocery", price_cents: 649, in_stock: true },
  { sku: "GRO-006", name: "Chicken Breast (1 lb)", category: "grocery", price_cents: 899, in_stock: true },
  { sku: "GRO-007", name: "Pasta (16oz)", category: "grocery", price_cents: 179, in_stock: true },
  { sku: "GRO-008", name: "Marinara Sauce", category: "grocery", price_cents: 399, in_stock: true },

  // Alcohol (blocked category for demo)
  { sku: "ALC-001", name: "Red Wine (750ml)", category: "alcohol", price_cents: 1499, in_stock: true },
  { sku: "ALC-002", name: "Craft Beer (6-pack)", category: "alcohol", price_cents: 1299, in_stock: true },
  { sku: "ALC-003", name: "Whiskey (750ml)", category: "alcohol", price_cents: 3499, in_stock: true },

  // Gift cards (blocked category for demo)
  { sku: "GFT-001", name: "Amazon Gift Card ($50)", category: "gift_cards", price_cents: 5000, in_stock: true },
  { sku: "GFT-002", name: "Visa Gift Card ($100)", category: "gift_cards", price_cents: 10000, in_stock: true },

  // Tobacco (blocked category for demo)
  { sku: "TOB-001", name: "Cigarettes (pack)", category: "tobacco", price_cents: 1299, in_stock: true },

  // Household (allowed)
  { sku: "HOU-001", name: "Paper Towels (6 rolls)", category: "household", price_cents: 899, in_stock: true },
  { sku: "HOU-002", name: "Dish Soap", category: "household", price_cents: 349, in_stock: true },
];

// -----------------------------------------------------------------------------
// Orders (in-memory for demo)
// -----------------------------------------------------------------------------

interface OrderItem {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  qty: number;
}

interface Order {
  order_id: string;
  vendor: string;
  items: OrderItem[];
  total_cents: number;
  status: "pending" | "approved" | "denied";
  created_at: string;
  receipt_id?: string;
  denied_reason?: string;
}

const orders = new Map<string, Order>();

function makeOrderId(): string {
  return `ord_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "capnet-sandbox",
    version: "0.1.0",
    build: BUILD,
    vendor: VENDOR,
    timestamp: new Date().toISOString(),
  });
});

// -----------------------------------------------------------------------------
// GET /catalog
// -----------------------------------------------------------------------------

app.get("/catalog", (_req, res) => {
  res.json({
    vendor: VENDOR,
    items: CATALOG,
    blocked_categories: ["alcohol", "gift_cards", "tobacco"],
  });
});

// -----------------------------------------------------------------------------
// POST /cart/validate
// Validates a cart and returns ActionRequest-shaped payload for proxy
// -----------------------------------------------------------------------------

interface CartValidateRequest {
  agent_id: string;
  agent_pubkey: string;
  cart: Array<{ sku: string; qty: number }>;
}

app.post("/cart/validate", (req, res) => {
  const { agent_id, agent_pubkey, cart } = req.body as CartValidateRequest;

  if (!agent_id || !agent_pubkey || !Array.isArray(cart) || cart.length === 0) {
    res.status(400).json({ error: "INVALID_INPUT", message: "agent_id, agent_pubkey, and cart required" });
    return;
  }

  // Resolve SKUs to catalog items
  const resolvedItems: OrderItem[] = [];
  for (const { sku, qty } of cart) {
    const item = CATALOG.find((c) => c.sku === sku);
    if (!item) {
      res.status(400).json({ error: "UNKNOWN_SKU", sku });
      return;
    }
    if (!item.in_stock) {
      res.status(400).json({ error: "OUT_OF_STOCK", sku });
      return;
    }
    if (qty < 1 || qty > 100) {
      res.status(400).json({ error: "INVALID_QTY", sku, qty });
      return;
    }
    resolvedItems.push({
      sku: item.sku,
      name: item.name,
      category: item.category,
      price_cents: item.price_cents,
      qty,
    });
  }

  // Compute total
  const total_cents = resolvedItems.reduce((s, i) => s + i.price_cents * i.qty, 0);

  // Build ActionRequest payload (for proxy)
  const request_id = `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const actionRequest = {
    request_id,
    ts: new Date().toISOString(),
    agent_id,
    agent_pubkey,
    action: "spend" as const,
    vendor: VENDOR,
    currency: "USD" as const,
    cart: resolvedItems.map((i) => ({
      sku: i.sku,
      name: i.name,
      category: i.category,
      price_cents: i.price_cents,
      qty: i.qty,
    })),
  };

  res.json({
    valid: true,
    vendor: VENDOR,
    items: resolvedItems,
    total_cents,
    action_request: actionRequest,
  });
});

// -----------------------------------------------------------------------------
// POST /checkout
// Creates an order after proxy approval
// -----------------------------------------------------------------------------

interface CheckoutRequest {
  request_id: string;
  receipt_id: string;
  cart: Array<{ sku: string; qty: number }>;
}

app.post("/checkout", (req, res) => {
  const { request_id, receipt_id, cart } = req.body as CheckoutRequest;

  if (!request_id || !receipt_id || !Array.isArray(cart) || cart.length === 0) {
    res.status(400).json({ error: "INVALID_INPUT", message: "request_id, receipt_id, and cart required" });
    return;
  }

  // Resolve SKUs
  const resolvedItems: OrderItem[] = [];
  for (const { sku, qty } of cart) {
    const item = CATALOG.find((c) => c.sku === sku);
    if (!item) {
      res.status(400).json({ error: "UNKNOWN_SKU", sku });
      return;
    }
    resolvedItems.push({
      sku: item.sku,
      name: item.name,
      category: item.category,
      price_cents: item.price_cents,
      qty,
    });
  }

  const total_cents = resolvedItems.reduce((s, i) => s + i.price_cents * i.qty, 0);

  // Create order
  const order: Order = {
    order_id: makeOrderId(),
    vendor: VENDOR,
    items: resolvedItems,
    total_cents,
    status: "approved",
    created_at: new Date().toISOString(),
    receipt_id,
  };

  orders.set(order.order_id, order);

  res.json({
    success: true,
    order,
  });
});

// -----------------------------------------------------------------------------
// GET /orders/:id
// -----------------------------------------------------------------------------

app.get("/orders/:id", (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) {
    res.status(404).json({ error: "ORDER_NOT_FOUND" });
    return;
  }
  res.json(order);
});

// -----------------------------------------------------------------------------
// GET /orders
// -----------------------------------------------------------------------------

app.get("/orders", (_req, res) => {
  res.json(Array.from(orders.values()));
});

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[sandbox] listening on http://localhost:${PORT}`);
  console.log(`[sandbox] vendor: ${VENDOR}`);
  console.log(`[sandbox] catalog: ${CATALOG.length} items`);
});
