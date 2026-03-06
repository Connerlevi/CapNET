/**
 * Shared utilities for CapNet demo scripts.
 *
 * Extracted from demo.ts so scenario scripts can reuse the same
 * fetch wrapper, logging helpers, health-checks, and types.
 */

import {
  generateEd25519Keypair,
  type Keypair,
  type CapDoc,
  type ActionResult,
  type Receipt,
  type ActionRequest,
} from "@capnet/shared";

// Re-export for convenience — scenario scripts only need to import demo-utils
export {
  generateEd25519Keypair,
  type Keypair,
  type CapDoc,
  type ActionResult,
  type Receipt,
  type ActionRequest,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROXY_URL = process.env.PROXY_URL || "http://127.0.0.1:3100";
export const SANDBOX_URL = process.env.SANDBOX_URL || "http://127.0.0.1:3200";
export const TIMEOUT_MS = 2500;
export const RECORD_MODE = process.argv.includes("--record");

export function pause(ms = 1500): Promise<void> {
  if (!RECORD_MODE) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Fetch with Timeout
// ---------------------------------------------------------------------------

export async function fetchJson<T>(
  url: string,
  options?: RequestInit,
  timeoutMs = TIMEOUT_MS,
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

export function logStep(n: number, msg: string) {
  console.log(`\n[${n}] ${msg}`);
}

export function die(msg: string, hint?: string): never {
  console.error(`\nERROR: ${msg}`);
  if (hint) console.error(`HINT: ${hint}`);
  process.exit(1);
}

export function logHeader(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

export function logDecision(result: ActionResult) {
  const tag = result.decision === "allow" ? "ALLOWED" : "DENIED";
  console.log(`    Decision: ${tag}`);
  console.log(`    Reason:   ${result.reason}`);
}

// ---------------------------------------------------------------------------
// Health Checks
// ---------------------------------------------------------------------------

export async function checkProxy(): Promise<void> {
  try {
    const h = await fetchJson<{ status: string }>(`${PROXY_URL}/health`);
    console.log(`    Proxy:   ${h.status}`);
  } catch {
    die("Proxy not running", "Start with: npm run dev");
  }
}

export async function checkSandbox(): Promise<void> {
  try {
    const h = await fetchJson<{ status: string }>(`${SANDBOX_URL}/health`);
    console.log(`    Sandbox: ${h.status}`);
  } catch {
    die("Sandbox not running", "Start with: npm run dev");
  }
}

// ---------------------------------------------------------------------------
// Request-ID Generator
// ---------------------------------------------------------------------------

export function makeRequestId(): string {
  const ts = Date.now();
  const hex = Math.random().toString(16).slice(2, 10);
  return `req_${ts}_${hex}`;
}

// ---------------------------------------------------------------------------
// Audit Trail Printer
// ---------------------------------------------------------------------------

export async function printAuditTrail(limit = 20): Promise<void> {
  const receipts = await fetchJson<Receipt[]>(
    `${PROXY_URL}/receipts?limit=${limit}`,
  );

  const sorted = [...receipts].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  );

  console.log("");
  for (const r of sorted) {
    const time = new Date(r.ts).toLocaleTimeString();
    const summary = r.summary.denied_reason
      ? ` (${r.summary.denied_reason})`
      : r.summary.amount_cents
        ? ` ($${(r.summary.amount_cents / 100).toFixed(2)})`
        : "";
    console.log(`    ${time} | ${r.event}${summary}`);
  }
}

// ---------------------------------------------------------------------------
// Sandbox Types (matches sandbox/src/index.ts)
// ---------------------------------------------------------------------------

export interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  in_stock: boolean;
}

export interface CatalogResponse {
  vendor: string;
  items: CatalogItem[];
  blocked_categories: string[];
}

export interface CartValidateResponse {
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

export interface CheckoutResponse {
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
