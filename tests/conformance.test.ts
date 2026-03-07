/**
 * CapNet Conformance Tests (Prompt 9)
 *
 * Integration tests that run against the live proxy + sandbox.
 * Start services first: npm run dev
 *
 * Tests:
 *  1. Accept allowed purchase
 *  2. Reject blocked category
 *  3. Reject amount over budget
 *  4. Reject wrong executor (pubkey mismatch)
 *  5. Reject revoked capability
 *  6. Reject expanded scope in delegation (attenuation violation)
 *  7. Verify receipts match ActionResults
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { generateEd25519Keypair, type Keypair, type CapDoc, type ActionResult } from "@capnet/shared";

const PROXY = process.env.PROXY_URL || "http://127.0.0.1:3100";
const SANDBOX = process.env.SANDBOX_URL || "http://127.0.0.1:3200";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok && !body.error && !body.decision) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

async function issueSpendCap(
  agentId: string,
  agentPubkey: string,
  opts: {
    max_amount_cents?: number;
    allowed_vendors?: string[];
    blocked_categories?: string[];
  } = {},
): Promise<CapDoc> {
  return fetchJson<CapDoc>(`${PROXY}/capability/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template: "test",
      agent_id: agentId,
      agent_pubkey: agentPubkey,
      constraints: {
        max_amount_cents: opts.max_amount_cents ?? 5000,
        allowed_vendors: opts.allowed_vendors ?? ["sandboxmart"],
        blocked_categories: opts.blocked_categories ?? ["alcohol", "tobacco", "gift_cards"],
      },
    }),
  });
}

async function issueToolCallCap(
  agentId: string,
  agentPubkey: string,
  opts: {
    allowed_tools?: string[];
    blocked_tool_categories?: string[];
  } = {},
): Promise<CapDoc> {
  return fetchJson<CapDoc>(`${PROXY}/capability/issue/toolcall`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template: "test",
      agent_id: agentId,
      agent_pubkey: agentPubkey,
      constraints: {
        allowed_tools: opts.allowed_tools ?? ["read_logs", "run_tests"],
        blocked_tool_categories: opts.blocked_tool_categories ?? ["shell"],
      },
    }),
  });
}

interface CartValidateResponse {
  valid: boolean;
  total_cents: number;
  action_request: {
    request_id: string;
    ts: string;
    agent_id: string;
    agent_pubkey: string;
    vendor: string;
    action: string;
    cart: Array<{ sku: string; name: string; category: string; price_cents: number; qty: number }>;
  };
}

async function validateCart(
  agentId: string,
  agentPubkey: string,
  cart: Array<{ sku: string; qty: number }>,
): Promise<CartValidateResponse> {
  return fetchJson<CartValidateResponse>(`${SANDBOX}/cart/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: agentId, agent_pubkey: agentPubkey, cart }),
  });
}

async function submitAction(actionRequest: CartValidateResponse["action_request"]): Promise<ActionResult> {
  return fetchJson<ActionResult>(`${PROXY}/action/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(actionRequest),
  });
}

type ToolCategory = "shell" | "web" | "browser" | "messaging" | "filesystem" | "spawn" | "device" | "other";

async function submitToolCall(
  agentId: string,
  agentPubkey: string,
  toolName: string,
  toolCategory: ToolCategory,
): Promise<ActionResult> {
  return fetchJson<ActionResult>(`${PROXY}/action/toolcall`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request_id: `req_test_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      ts: new Date().toISOString(),
      agent_id: agentId,
      agent_pubkey: agentPubkey,
      action: "tool_call",
      tool_name: toolName,
      tool_category: toolCategory,
      tool_input: {},
    }),
  });
}

async function revokeCap(capId: string): Promise<{ success: boolean; revoked_count: number }> {
  return fetchJson(`${PROXY}/capability/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cap_id: capId }),
  });
}

interface Receipt {
  receipt_id: string;
  event: string;
  request_id?: string;
  cap_id?: string;
  agent_id?: string;
  summary: Record<string, unknown>;
}

async function getReceipts(limit = 100): Promise<Receipt[]> {
  return fetchJson<Receipt[]>(`${PROXY}/receipts?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let agentKey: Keypair;
const AGENT_ID = "agent:test-conformance";

beforeAll(async () => {
  // Verify services are running
  const proxyHealth = await fetchJson<{ status: string }>(`${PROXY}/health`);
  expect(proxyHealth.status).toBe("ok");
  const sandboxHealth = await fetchJson<{ status: string }>(`${SANDBOX}/health`);
  expect(sandboxHealth.status).toBe("ok");
});

beforeEach(() => {
  // Fresh keypair per test to avoid cap collisions
  agentKey = generateEd25519Keypair();
});

describe("Spend enforcement", () => {
  it("accepts an allowed purchase", async () => {
    await issueSpendCap(AGENT_ID, agentKey.publicKeyB64, { max_amount_cents: 5000 });

    const validation = await validateCart(AGENT_ID, agentKey.publicKeyB64, [
      { sku: "GRO-001", qty: 1 }, // Whole Milk ~$4.99
    ]);
    const result = await submitAction(validation.action_request);

    expect(result.decision).toBe("allow");
    expect(result.reason).toBe("ALLOWED");
    expect(result.receipt_id).toBeTruthy();
  });

  it("rejects a blocked category", async () => {
    await issueSpendCap(AGENT_ID, agentKey.publicKeyB64, {
      blocked_categories: ["alcohol"],
    });

    const validation = await validateCart(AGENT_ID, agentKey.publicKeyB64, [
      { sku: "ALC-001", qty: 1 }, // Red Wine
    ]);
    const result = await submitAction(validation.action_request);

    expect(result.decision).toBe("deny");
    expect(result.reason).toBe("CATEGORY_BLOCKED:alcohol");
  });

  it("rejects amount over budget", async () => {
    await issueSpendCap(AGENT_ID, agentKey.publicKeyB64, {
      max_amount_cents: 100, // $1 budget
    });

    const validation = await validateCart(AGENT_ID, agentKey.publicKeyB64, [
      { sku: "GRO-001", qty: 1 }, // Whole Milk ~$4.99
    ]);
    const result = await submitAction(validation.action_request);

    expect(result.decision).toBe("deny");
    expect(result.reason).toBe("AMOUNT_EXCEEDS_MAX");
  });

  it("rejects wrong executor (pubkey mismatch)", async () => {
    await issueSpendCap(AGENT_ID, agentKey.publicKeyB64);

    // Use a different keypair for the action request
    const wrongKey = generateEd25519Keypair();
    const validation = await validateCart(AGENT_ID, wrongKey.publicKeyB64, [
      { sku: "GRO-001", qty: 1 },
    ]);
    const result = await submitAction(validation.action_request);

    // Could be NO_CAPABILITY (no cap matches the wrong pubkey) or EXECUTOR_MISMATCH
    expect(result.decision).toBe("deny");
    expect(["EXECUTOR_MISMATCH", "NO_CAPABILITY"]).toContain(result.reason);
  });

  it("rejects after revocation", async () => {
    const cap = await issueSpendCap(AGENT_ID, agentKey.publicKeyB64);
    await revokeCap(cap.cap_id);

    const validation = await validateCart(AGENT_ID, agentKey.publicKeyB64, [
      { sku: "GRO-001", qty: 1 },
    ]);
    const result = await submitAction(validation.action_request);

    expect(result.decision).toBe("deny");
    expect(result.reason).toBe("REVOKED");
  });
});

describe("Tool call enforcement", () => {
  it("accepts an allowed tool call", async () => {
    await issueToolCallCap(AGENT_ID, agentKey.publicKeyB64, {
      allowed_tools: ["read_logs", "run_tests"],
      blocked_tool_categories: ["shell"],
    });

    const result = await submitToolCall(AGENT_ID, agentKey.publicKeyB64, "read_logs", "web");

    expect(result.decision).toBe("allow");
    expect(result.reason).toBe("ALLOWED");
  });

  it("rejects a tool not in allowed list", async () => {
    await issueToolCallCap(AGENT_ID, agentKey.publicKeyB64, {
      allowed_tools: ["read_logs"],
    });

    const result = await submitToolCall(AGENT_ID, agentKey.publicKeyB64, "drop_database", "web");

    expect(result.decision).toBe("deny");
    expect(result.reason).toBe("TOOL_NOT_ALLOWED");
  });

  it("rejects a blocked tool category", async () => {
    await issueToolCallCap(AGENT_ID, agentKey.publicKeyB64, {
      allowed_tools: ["exec_command"],
      blocked_tool_categories: ["shell"],
    });

    const result = await submitToolCall(AGENT_ID, agentKey.publicKeyB64, "exec_command", "shell");

    expect(result.decision).toBe("deny");
    expect(result.reason).toBe("TOOL_CATEGORY_BLOCKED:shell");
  });
});

describe("Delegation and attenuation", () => {
  it("rejects expanded budget in delegation", async () => {
    const parentCap = await issueSpendCap(AGENT_ID, agentKey.publicKeyB64, {
      max_amount_cents: 5000,
    });

    const childKey = generateEd25519Keypair();
    const res = await fetch(`${PROXY}/capability/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_cap_id: parentCap.cap_id,
        new_executor: {
          agent_id: "agent:test-child",
          agent_pubkey: childKey.publicKeyB64,
        },
        constraints: {
          max_amount_cents: 10000, // MORE than parent — should fail
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol", "tobacco", "gift_cards"],
        },
      }),
    });

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("ATTENUATION_VIOLATION");
  });

  it("rejects removing a blocked category in delegation", async () => {
    const parentCap = await issueSpendCap(AGENT_ID, agentKey.publicKeyB64, {
      blocked_categories: ["alcohol", "tobacco"],
    });

    const childKey = generateEd25519Keypair();
    const res = await fetch(`${PROXY}/capability/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_cap_id: parentCap.cap_id,
        new_executor: {
          agent_id: "agent:test-child",
          agent_pubkey: childKey.publicKeyB64,
        },
        constraints: {
          max_amount_cents: 5000,
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol"], // removed tobacco — should fail
        },
      }),
    });

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("ATTENUATION_VIOLATION");
  });

  it("rejects adding a vendor not in parent", async () => {
    const parentCap = await issueSpendCap(AGENT_ID, agentKey.publicKeyB64, {
      allowed_vendors: ["sandboxmart"],
    });

    const childKey = generateEd25519Keypair();
    const res = await fetch(`${PROXY}/capability/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_cap_id: parentCap.cap_id,
        new_executor: {
          agent_id: "agent:test-child",
          agent_pubkey: childKey.publicKeyB64,
        },
        constraints: {
          max_amount_cents: 5000,
          allowed_vendors: ["sandboxmart", "evilmart"], // new vendor — should fail
          blocked_categories: ["alcohol", "tobacco", "gift_cards"],
        },
      }),
    });

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("ATTENUATION_VIOLATION");
  });

  it("accepts valid attenuated delegation", async () => {
    const parentCap = await issueSpendCap(AGENT_ID, agentKey.publicKeyB64, {
      max_amount_cents: 5000,
      blocked_categories: ["alcohol"],
    });

    const childKey = generateEd25519Keypair();
    const childCap = await fetchJson<CapDoc>(`${PROXY}/capability/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_cap_id: parentCap.cap_id,
        new_executor: {
          agent_id: "agent:test-child",
          agent_pubkey: childKey.publicKeyB64,
        },
        constraints: {
          max_amount_cents: 2000, // less than parent
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol", "gift_cards"], // superset of parent
        },
      }),
    });

    expect(childCap.cap_id).toBeTruthy();
    expect(childCap.parent_cap_id).toBe(parentCap.cap_id);
    expect(childCap.delegation_depth).toBe(1);
  });

  it("denies delegated cap after parent is revoked (cascade)", async () => {
    const parentCap = await issueSpendCap(AGENT_ID, agentKey.publicKeyB64, {
      max_amount_cents: 5000,
    });

    const childKey = generateEd25519Keypair();
    const childCap = await fetchJson<CapDoc>(`${PROXY}/capability/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_cap_id: parentCap.cap_id,
        new_executor: {
          agent_id: "agent:test-child",
          agent_pubkey: childKey.publicKeyB64,
        },
        constraints: {
          max_amount_cents: 2000,
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol", "tobacco", "gift_cards"],
        },
      }),
    });

    // Child should work before revocation
    const validation1 = await validateCart("agent:test-child", childKey.publicKeyB64, [
      { sku: "GRO-001", qty: 1 },
    ]);
    const result1 = await submitAction(validation1.action_request);
    expect(result1.decision).toBe("allow");

    // Revoke parent
    const revokeResult = await revokeCap(parentCap.cap_id);
    expect(revokeResult.success).toBe(true);
    expect(revokeResult.revoked_count).toBeGreaterThanOrEqual(2); // parent + child

    // Child should be denied after cascade revocation
    const validation2 = await validateCart("agent:test-child", childKey.publicKeyB64, [
      { sku: "GRO-001", qty: 1 },
    ]);
    const result2 = await submitAction(validation2.action_request);
    expect(result2.decision).toBe("deny");
    expect(["REVOKED", "PARENT_REVOKED"]).toContain(result2.reason);
  });
});

describe("Receipts match ActionResults", () => {
  it("receipt_id in ActionResult exists in receipts log", async () => {
    await issueSpendCap(AGENT_ID, agentKey.publicKeyB64);

    const validation = await validateCart(AGENT_ID, agentKey.publicKeyB64, [
      { sku: "GRO-001", qty: 1 },
    ]);
    const result = await submitAction(validation.action_request);
    expect(result.receipt_id).toBeTruthy();

    // Fetch receipts and find the matching one
    const receipts = await getReceipts(200);
    const matching = receipts.find((r) => r.receipt_id === result.receipt_id);

    expect(matching).toBeDefined();
    expect(matching!.event).toBe("ACTION_ALLOWED");
    expect(matching!.request_id).toBe(result.request_id);
  });

  it("denied action produces matching receipt", async () => {
    await issueSpendCap(AGENT_ID, agentKey.publicKeyB64, {
      blocked_categories: ["alcohol"],
    });

    const validation = await validateCart(AGENT_ID, agentKey.publicKeyB64, [
      { sku: "ALC-001", qty: 1 },
    ]);
    const result = await submitAction(validation.action_request);
    expect(result.decision).toBe("deny");

    const receipts = await getReceipts(200);
    const matching = receipts.find((r) => r.receipt_id === result.receipt_id);

    expect(matching).toBeDefined();
    expect(matching!.event).toBe("ACTION_DENIED");
    expect(matching!.summary.denied_reason).toBe("CATEGORY_BLOCKED:alcohol");
  });
});
