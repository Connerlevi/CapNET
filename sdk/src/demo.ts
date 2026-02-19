#!/usr/bin/env npx tsx
/**
 * CapNet Demo Agent Script
 *
 * Demonstrates the full capability lifecycle:
 * 1. Generate/load agent Ed25519 keypair
 * 2. Wallet issues capability to agent
 * 3. Fetch catalog from sandbox
 * 4. Build cart and validate → allowed action
 * 5. Attempt blocked category → denied action
 * 6. Revoke capability → subsequent actions denied
 * 7. Show audit trail (receipts)
 *
 * Usage: npx tsx sdk/src/demo.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  generateEd25519Keypair,
  type Keypair,
  type CapDoc,
  type ActionRequest,
  type ActionResult,
  type Receipt,
} from "@capnet/shared";

const PROXY_URL = process.env.PROXY_URL || "http://127.0.0.1:3100";
const SANDBOX_URL = process.env.SANDBOX_URL || "http://127.0.0.1:3200";
const AGENT_KEY_PATH = path.join(__dirname, "../../data/demo_agent_key.json");
const TIMEOUT_MS = 2500;

// Demo agent identity
const AGENT_ID = "agent:demo-grocerybot";

// Seed for deterministic runs (optional)
// Usage: CAPNET_DEMO_SEED=abc npm run demo
const DEMO_SEED = process.env.CAPNET_DEMO_SEED || "";

// ---------------------------------------------------------------------------
// Agent Key Management
// ---------------------------------------------------------------------------

function loadOrCreateAgentKey(): Keypair {
  const dataDir = path.dirname(AGENT_KEY_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(AGENT_KEY_PATH)) {
    const data = JSON.parse(fs.readFileSync(AGENT_KEY_PATH, "utf-8"));
    console.log("    Loaded existing agent keypair");
    return data as Keypair;
  }

  const keypair = generateEd25519Keypair();
  fs.writeFileSync(AGENT_KEY_PATH, JSON.stringify(keypair, null, 2));
  console.log("    Generated new agent keypair");
  return keypair;
}

// ---------------------------------------------------------------------------
// Fetch with Timeout
// ---------------------------------------------------------------------------

async function fetchJson<T>(
  url: string,
  options?: RequestInit,
  timeoutMs = TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Logging Helpers
// ---------------------------------------------------------------------------

function logStep(n: number, msg: string) {
  console.log(`\n[${n}] ${msg}`);
}

function die(msg: string, hint?: string): never {
  console.error(`\nERROR: ${msg}`);
  if (hint) console.error(`HINT: ${hint}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Types from sandbox (matches sandbox/src/index.ts)
// ---------------------------------------------------------------------------

interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  in_stock: boolean;
}

interface CatalogResponse {
  vendor: string;
  items: CatalogItem[];
  blocked_categories: string[];
}

interface CartValidateResponse {
  valid: boolean;
  vendor: string;
  items: Array<{
    sku: string;
    name: string;
    category: string;
    price_cents: number;
    qty: number;
  }>;
  total_cents: number;
  action_request: ActionRequest;
}

interface CheckoutResponse {
  success: boolean;
  order: {
    order_id: string;
    vendor: string;
    total_cents: number;
    status: string;
    created_at: string;
    receipt_id: string;
  };
}

// ---------------------------------------------------------------------------
// Main Demo
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("CapNet Demo Agent — Capability Lifecycle");
  console.log("=".repeat(60));
  if (DEMO_SEED) {
    console.log(`Seed: ${DEMO_SEED}`);
  }

  // Step 1: Load or create agent keypair
  logStep(1, "Loading agent identity...");
  let agentKey: Keypair;
  try {
    agentKey = loadOrCreateAgentKey();
  } catch (err) {
    die("Failed to load/create agent key", "Check write permissions on data/");
  }
  console.log(`    Agent ID: ${AGENT_ID}`);
  console.log(`    Pubkey: ${agentKey.publicKeyB64.slice(0, 20)}...`);

  // Step 2: Check services are running
  logStep(2, "Checking services...");
  try {
    const proxyHealth = await fetchJson<{ status: string }>(`${PROXY_URL}/health`);
    console.log(`    Proxy: ${proxyHealth.status}`);
  } catch (err) {
    die("Proxy not running", "Start with: npm run dev");
  }

  try {
    const sandboxHealth = await fetchJson<{ status: string }>(`${SANDBOX_URL}/health`);
    console.log(`    Sandbox: ${sandboxHealth.status}`);
  } catch (err) {
    die("Sandbox not running", "Start with: npm run dev");
  }

  // Step 3: Wallet issues capability to agent
  logStep(3, "Wallet issuing capability to agent...");
  let cap: CapDoc;
  try {
    cap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "groceries",
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        constraints: {
          max_amount_cents: 5000, // $50 budget
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol", "tobacco", "gift_cards"],
        },
      }),
    });
  } catch (err) {
    die(`Failed to issue capability: ${err instanceof Error ? err.message : err}`);
  }
  console.log(`    Cap ID: ${cap.cap_id}`);
  console.log(`    Budget: $${(cap.constraints.max_amount_cents / 100).toFixed(2)}`);
  console.log(`    Expires: ${new Date(cap.expires_at).toLocaleString()}`);
  console.log(`    Blocked: ${cap.constraints.blocked_categories.join(", ")}`);

  // Step 4: Fetch catalog
  logStep(4, "Fetching merchant catalog...");
  let catalog: CatalogResponse;
  try {
    catalog = await fetchJson<CatalogResponse>(`${SANDBOX_URL}/catalog`);
  } catch (err) {
    die(
      "Failed to fetch catalog",
      "Sandbox /catalog endpoint may not be implemented. Run: npm run dev"
    );
  }
  console.log(`    Vendor: ${catalog.vendor}`);
  console.log(`    Items: ${catalog.items.length}`);
  console.log(`    Blocked: ${catalog.blocked_categories.join(", ")}`);

  // Step 5: Build grocery cart and attempt allowed action
  logStep(5, "Building grocery cart (should be ALLOWED)...");
  const groceryItems = catalog.items.filter(
    (i) => i.category === "grocery" && i.in_stock
  );
  const groceryCart = groceryItems.slice(0, 3).map((i) => ({ sku: i.sku, qty: 1 }));

  console.log("    Cart:");
  for (const c of groceryCart) {
    const item = catalog.items.find((i) => i.sku === c.sku);
    console.log(`      - ${item?.name} ($${((item?.price_cents ?? 0) / 100).toFixed(2)})`);
  }

  // Validate cart
  const groceryValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        cart: groceryCart,
      }),
    }
  );
  console.log(`    Total: $${(groceryValidation.total_cents / 100).toFixed(2)}`);

  // Submit to proxy
  const groceryResult = await fetchJson<ActionResult>(`${PROXY_URL}/action/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(groceryValidation.action_request),
  });
  console.log(`    Decision: ${groceryResult.decision.toUpperCase()}`);
  console.log(`    Reason: ${groceryResult.reason}`);

  // Checkout if allowed
  if (groceryResult.decision === "allow") {
    const order = await fetchJson<CheckoutResponse>(`${SANDBOX_URL}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: groceryResult.request_id,
        receipt_id: groceryResult.receipt_id,
        cart: groceryCart,
      }),
    });
    console.log(`    Order: ${order.order.order_id} ✓`);
  }

  // Step 6: Attempt blocked category (alcohol)
  logStep(6, "Attempting to buy alcohol (should be DENIED)...");
  const alcoholCart = [{ sku: "ALC-001", qty: 1 }]; // Red Wine
  const alcoholValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        cart: alcoholCart,
      }),
    }
  );
  const wineItem = catalog.items.find((i) => i.sku === "ALC-001");
  console.log(`    Cart: ${wineItem?.name} ($${((wineItem?.price_cents ?? 0) / 100).toFixed(2)})`);

  const alcoholResult = await fetchJson<ActionResult>(`${PROXY_URL}/action/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alcoholValidation.action_request),
  });
  console.log(`    Decision: ${alcoholResult.decision.toUpperCase()}`);
  console.log(`    Reason: ${alcoholResult.reason}`);

  // Step 7: Revoke capability
  logStep(7, "Revoking capability...");
  try {
    await fetchJson<{ success: boolean }>(`${PROXY_URL}/capability/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cap_id: cap.cap_id }),
    });
    console.log(`    Revoked: ${cap.cap_id}`);
  } catch (err) {
    die(`Failed to revoke: ${err instanceof Error ? err.message : err}`);
  }

  // Step 8: Attempt action after revoke (should fail)
  logStep(8, "Attempting groceries after revoke (should be DENIED)...");
  // Need to re-validate to get fresh request_id
  const postRevokeValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        cart: groceryCart,
      }),
    }
  );

  const postRevokeResult = await fetchJson<ActionResult>(`${PROXY_URL}/action/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postRevokeValidation.action_request),
  });
  console.log(`    Decision: ${postRevokeResult.decision.toUpperCase()}`);
  console.log(`    Reason: ${postRevokeResult.reason}`);

  // Step 9: Show audit trail
  logStep(9, "Audit trail (last 10 receipts, oldest first)...");
  const receipts = await fetchJson<Receipt[]>(`${PROXY_URL}/receipts?limit=10`);

  // Sort by timestamp ascending (oldest first) for consistent ordering
  const sortedReceipts = [...receipts].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  console.log("");
  for (const r of sortedReceipts) {
    const time = new Date(r.ts).toLocaleTimeString();
    const summary = r.summary.denied_reason
      ? ` (${r.summary.denied_reason})`
      : r.summary.amount_cents
        ? ` ($${(r.summary.amount_cents / 100).toFixed(2)})`
        : "";
    console.log(`    ${time} | ${r.event}${summary}`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Demo Summary");
  console.log("=".repeat(60));
  console.log("  ✓ Groceries allowed (within budget, allowed vendor)");
  console.log("  ✗ Alcohol denied (blocked category)");
  console.log("  ✗ Post-revoke denied (capability revoked)");
  console.log("\nThe leash works. Agents can act, but only within bounds.");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
