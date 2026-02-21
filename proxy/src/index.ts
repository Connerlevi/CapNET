import express from "express";
import cors from "cors";
import crypto from "crypto";
import {
  CapDocSchema,
  ActionRequestSchema,
  ToolCallRequestSchema,
  type CapDoc,
  type ActionRequest,
  type ToolCallRequest,
  type ActionResult,
  type Receipt,
  type SpendConstraints,
  type ToolCallConstraints,
  generateEd25519Keypair,
  signObjectEd25519,
  verifyObjectEd25519,
  capUnsignedPayload,
} from "@capnet/shared";

// Type guards for constraint narrowing
function isSpendConstraints(c: SpendConstraints | ToolCallConstraints): c is SpendConstraints {
  return "allowed_vendors" in c;
}

function isToolCallConstraints(c: SpendConstraints | ToolCallConstraints): c is ToolCallConstraints {
  return "allowed_tools" in c;
}
import { z } from "zod";
import {
  storeCap,
  getCap,
  getAllCaps,
  findCapForAgent,
  isRevoked,
  revokeCap,
  appendReceipt,
  getReceipts,
  loadOrCreateIssuerKeys,
} from "./store";

const app = express();
const PORT = Number(process.env.PORT) || 3100;

// -----------------------------------------------------------------------------
// CORS (least-privilege: only extension + known local origins)
// -----------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3200",
  "http://127.0.0.1:3200",
]);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return cb(null, true);
      // Allow Chrome extension
      if (origin.startsWith("chrome-extension://")) return cb(null, true);
      // Allow known local origins (sandbox, etc.)
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      // Allow localhost/127.0.0.1 on any port for dev flexibility
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      // Block everything else
      return cb(new Error("CORS_BLOCKED"), false);
    },
  })
);
app.use(express.json({ limit: "256kb" }));

// -----------------------------------------------------------------------------
// Issuer keypair (generated once, reused)
// -----------------------------------------------------------------------------

const issuerKeys = loadOrCreateIssuerKeys(() => generateEd25519Keypair());
console.log(`[proxy] issuer pubkey: ${issuerKeys.publicKeyB64}`);

// -----------------------------------------------------------------------------
// Shared validators
// -----------------------------------------------------------------------------

/** Base64 format validator */
const Base64Schema = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, "must be valid base64");

/** Ed25519 public key: base64, decodes to 32 bytes */
const Ed25519PubkeySchema = Base64Schema.refine(
  (b64) => {
    try {
      const len = Math.floor((b64.replace(/=/g, "").length * 3) / 4);
      return len === 32;
    } catch {
      return false;
    }
  },
  { message: "must be 32-byte Ed25519 public key (base64)" }
);

/** Normalized string: trimmed, lowercase */
const NormalizedString = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .transform((s) => s.toLowerCase());

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeReceiptId(): string {
  return `rcpt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function makeCapId(): string {
  return `cap_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

/** JSON-safe value type for receipt meta */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Emit a receipt. Accepts optional receipt_id; generates one if not provided.
 * Returns the stored receipt with its final receipt_id.
 */
function emitReceipt(
  partial: Omit<Receipt, "receipt_id" | "ts" | "meta"> & {
    receipt_id?: string;
    ts?: string;
    meta?: Record<string, JsonValue>;
  }
): Receipt {
  const receipt: Receipt = {
    ...partial,
    receipt_id: partial.receipt_id ?? makeReceiptId(),
    ts: partial.ts ?? new Date().toISOString(),
    meta: partial.meta ?? {},
  };
  appendReceipt(receipt);
  return receipt;
}

// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "capnet-proxy",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

// -----------------------------------------------------------------------------
// POST /capability/issue
// -----------------------------------------------------------------------------

const IssueInputSchema = z
  .object({
    template: z.string().min(1).max(64),
    agent_id: z.string().min(3).max(128),
    agent_pubkey: Ed25519PubkeySchema,
    constraints: z
      .object({
        max_amount_cents: z.number().int().positive().max(100_000_000), // up to $1M
        allowed_vendors: z.array(NormalizedString).min(1).max(20),
        blocked_categories: z.array(NormalizedString).max(50),
      })
      .strict(),
  })
  .strict();

app.post("/capability/issue", (req, res) => {
  const parsed = IssueInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;
  // Schema guarantees min(1), but TS needs runtime check with noUncheckedIndexedAccess
  const vendor = input.constraints.allowed_vendors[0];
  if (!vendor) {
    res.status(400).json({ error: "INVALID_INPUT", message: "allowed_vendors must have at least one entry" });
    return;
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h

  // Build unsigned CapDoc
  const unsigned: Omit<CapDoc, "proof"> = {
    version: "capdoc/0.1",
    cap_id: makeCapId(),
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    issuer: {
      id: "wallet:local",
      pubkey: issuerKeys.publicKeyB64,
    },
    subject: { id: "user:local" },
    executor: {
      agent_id: input.agent_id,
      agent_pubkey: input.agent_pubkey,
    },
    resource: {
      type: "spend",
      vendor,
    },
    actions: ["spend"],
    constraints: {
      currency: "USD",
      max_amount_cents: input.constraints.max_amount_cents,
      allowed_vendors: input.constraints.allowed_vendors,
      blocked_categories: input.constraints.blocked_categories,
    },
    revocation: {
      mode: "strict",
      oracle: "local_proxy",
    },
  };

  // Sign
  const sig = signObjectEd25519(unsigned, issuerKeys.secretKeyB64, "capdoc");
  const capdocRaw: CapDoc = { ...unsigned, proof: { alg: "ed25519", sig } };

  // Validate against schema before storing (catches drift)
  const capdocParsed = CapDocSchema.safeParse(capdocRaw);
  if (!capdocParsed.success) {
    console.error("[proxy] CapDoc schema validation failed:", capdocParsed.error.flatten());
    res.status(500).json({ error: "CAPDOC_SCHEMA_FAILURE" });
    return;
  }
  const capdoc = capdocParsed.data;

  // Verify signature before storing
  if (!verifyObjectEd25519(capUnsignedPayload(capdoc), sig, issuerKeys.publicKeyB64, "capdoc")) {
    res.status(500).json({ error: "SIGNING_FAILURE" });
    return;
  }

  storeCap(capdoc);

  emitReceipt({
    event: "CAP_ISSUED",
    cap_id: capdoc.cap_id,
    agent_id: input.agent_id,
    summary: {
      amount_cents: input.constraints.max_amount_cents,
    },
  });

  res.json(capdoc);
});

// -----------------------------------------------------------------------------
// POST /action/request
// -----------------------------------------------------------------------------

app.post("/action/request", (req, res) => {
  const parsed = ActionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    return;
  }

  const actionReq: ActionRequest = parsed.data;

  // Compute totals once
  const totalCents = actionReq.cart.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const itemCount = actionReq.cart.reduce((s, i) => s + i.qty, 0);

  // Check safe integer
  if (!Number.isSafeInteger(totalCents)) {
    res.status(400).json({ error: "AMOUNT_OVERFLOW" });
    return;
  }

  // Always emit ACTION_ATTEMPT
  emitReceipt({
    event: "ACTION_ATTEMPT",
    request_id: actionReq.request_id,
    agent_id: actionReq.agent_id,
    vendor: actionReq.vendor,
    summary: {
      amount_cents: totalCents,
      item_count: itemCount,
    },
  });

  // Deny helper - emits receipt and returns ActionResult with matching receipt_id
  function deny(reason: string, capId?: string): ActionResult {
    const receipt = emitReceipt({
      event: "ACTION_DENIED",
      request_id: actionReq.request_id,
      agent_id: actionReq.agent_id,
      vendor: actionReq.vendor,
      cap_id: capId,
      summary: { denied_reason: reason },
    });
    return {
      request_id: actionReq.request_id,
      decision: "deny",
      reason,
      receipt_id: receipt.receipt_id,
    };
  }

  // Find matching capability (deterministic: newest issued first)
  const cap = findCapForAgent(actionReq.agent_id, actionReq.agent_pubkey);

  if (!cap) {
    res.json(deny("NO_CAPABILITY"));
    return;
  }

  // --- Verification order: signature first, then constraints ---

  // 1. Verify signature (before trusting any cap fields)
  if (
    !verifyObjectEd25519(
      capUnsignedPayload(cap),
      cap.proof.sig,
      cap.issuer.pubkey,
      "capdoc"
    )
  ) {
    res.json(deny("BAD_SIGNATURE", cap.cap_id));
    return;
  }

  // 2. Check executor binding
  if (
    cap.executor.agent_id !== actionReq.agent_id ||
    cap.executor.agent_pubkey !== actionReq.agent_pubkey
  ) {
    res.json(deny("EXECUTOR_MISMATCH", cap.cap_id));
    return;
  }

  // 3. Check time semantics with safe date parsing
  const nowMs = Date.now();

  const expMs = Date.parse(cap.expires_at);
  if (!Number.isFinite(expMs)) {
    res.json(deny("BAD_CAPABILITY_TIME", cap.cap_id));
    return;
  }
  if (expMs < nowMs) {
    res.json(deny("CAP_EXPIRED", cap.cap_id));
    return;
  }

  if (cap.not_before) {
    const nbMs = Date.parse(cap.not_before);
    if (!Number.isFinite(nbMs)) {
      res.json(deny("BAD_CAPABILITY_TIME", cap.cap_id));
      return;
    }
    if (nbMs > nowMs) {
      res.json(deny("CAP_NOT_YET_VALID", cap.cap_id));
      return;
    }
  }

  // 4. Check revocation
  if (isRevoked(cap.cap_id)) {
    res.json(deny("REVOKED", cap.cap_id));
    return;
  }

  // 5. Check action is allowed by this cap
  if (!cap.actions.includes("spend")) {
    res.json(deny("ACTION_NOT_ALLOWED", cap.cap_id));
    return;
  }

  // 6. Narrow constraints to spend type
  if (!isSpendConstraints(cap.constraints)) {
    res.json(deny("ACTION_NOT_ALLOWED", cap.cap_id));
    return;
  }
  const constraints = cap.constraints;

  // 7. Check vendor (already normalized by schema)
  if (!constraints.allowed_vendors.includes(actionReq.vendor)) {
    res.json(deny("VENDOR_NOT_ALLOWED", cap.cap_id));
    return;
  }

  // 8. Check blocked categories (already normalized by schema)
  for (const item of actionReq.cart) {
    if (constraints.blocked_categories.includes(item.category)) {
      res.json(deny(`CATEGORY_BLOCKED:${item.category}`, cap.cap_id));
      return;
    }
  }

  // 9. Check amount
  if (totalCents > constraints.max_amount_cents) {
    res.json(deny("AMOUNT_EXCEEDS_MAX", cap.cap_id));
    return;
  }

  // --- Allow ---
  const receipt = emitReceipt({
    event: "ACTION_ALLOWED",
    request_id: actionReq.request_id,
    agent_id: actionReq.agent_id,
    vendor: actionReq.vendor,
    cap_id: cap.cap_id,
    summary: {
      amount_cents: totalCents,
      item_count: itemCount,
    },
  });

  const result: ActionResult = {
    request_id: actionReq.request_id,
    decision: "allow",
    reason: "ALLOWED",
    receipt_id: receipt.receipt_id,
  };
  res.json(result);
});

// -----------------------------------------------------------------------------
// POST /capability/issue/toolcall — Issue a tool_call capability
// -----------------------------------------------------------------------------

const IssueToolCallInputSchema = z
  .object({
    template: z.string().min(1).max(64),
    agent_id: z.string().min(3).max(128),
    agent_pubkey: Ed25519PubkeySchema,
    constraints: z
      .object({
        allowed_tools: z.array(NormalizedString).min(1).max(100),
        blocked_tool_categories: z.array(NormalizedString).max(50),
        max_calls: z.number().int().positive().optional(),
      })
      .strict(),
  })
  .strict();

app.post("/capability/issue/toolcall", (req, res) => {
  const parsed = IssueToolCallInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h

  const unsigned: Omit<CapDoc, "proof"> = {
    version: "capdoc/0.1",
    cap_id: makeCapId(),
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    issuer: {
      id: "wallet:local",
      pubkey: issuerKeys.publicKeyB64,
    },
    subject: { id: "user:local" },
    executor: {
      agent_id: input.agent_id,
      agent_pubkey: input.agent_pubkey,
    },
    resource: {
      type: "tool_call",
      vendor: "openclaw",
    },
    actions: ["tool_call"],
    constraints: {
      allowed_tools: input.constraints.allowed_tools,
      blocked_tool_categories: input.constraints.blocked_tool_categories,
      ...(input.constraints.max_calls !== undefined
        ? { max_calls: input.constraints.max_calls }
        : {}),
    },
    revocation: {
      mode: "strict",
      oracle: "local_proxy",
    },
  };

  const sig = signObjectEd25519(unsigned, issuerKeys.secretKeyB64, "capdoc");
  const capdocRaw: CapDoc = { ...unsigned, proof: { alg: "ed25519", sig } };

  const capdocParsed = CapDocSchema.safeParse(capdocRaw);
  if (!capdocParsed.success) {
    console.error("[proxy] CapDoc schema validation failed:", capdocParsed.error.flatten());
    res.status(500).json({ error: "CAPDOC_SCHEMA_FAILURE" });
    return;
  }
  const capdoc = capdocParsed.data;

  if (!verifyObjectEd25519(capUnsignedPayload(capdoc), sig, issuerKeys.publicKeyB64, "capdoc")) {
    res.status(500).json({ error: "SIGNING_FAILURE" });
    return;
  }

  storeCap(capdoc);

  emitReceipt({
    event: "CAP_ISSUED",
    cap_id: capdoc.cap_id,
    agent_id: input.agent_id,
    summary: {},
    meta: { type: "tool_call", allowed_tools: input.constraints.allowed_tools },
  });

  res.json(capdoc);
});

// -----------------------------------------------------------------------------
// POST /action/toolcall — Enforce a tool call action
// -----------------------------------------------------------------------------

app.post("/action/toolcall", (req, res) => {
  const parsed = ToolCallRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    return;
  }

  const toolReq: ToolCallRequest = parsed.data;

  // Always emit ACTION_ATTEMPT
  emitReceipt({
    event: "ACTION_ATTEMPT",
    request_id: toolReq.request_id,
    agent_id: toolReq.agent_id,
    summary: {},
    meta: {
      action: "tool_call",
      tool_name: toolReq.tool_name,
      tool_category: toolReq.tool_category,
    },
  });

  // Deny helper
  function deny(reason: string, capId?: string): ActionResult {
    const receipt = emitReceipt({
      event: "ACTION_DENIED",
      request_id: toolReq.request_id,
      agent_id: toolReq.agent_id,
      cap_id: capId,
      summary: { denied_reason: reason },
      meta: { tool_name: toolReq.tool_name, tool_category: toolReq.tool_category },
    });
    return {
      request_id: toolReq.request_id,
      decision: "deny",
      reason,
      receipt_id: receipt.receipt_id,
    };
  }

  // Find matching capability
  const cap = findCapForAgent(toolReq.agent_id, toolReq.agent_pubkey);

  if (!cap) {
    res.json(deny("NO_CAPABILITY"));
    return;
  }

  // 1. Verify signature
  if (
    !verifyObjectEd25519(
      capUnsignedPayload(cap),
      cap.proof.sig,
      cap.issuer.pubkey,
      "capdoc"
    )
  ) {
    res.json(deny("BAD_SIGNATURE", cap.cap_id));
    return;
  }

  // 2. Check executor binding
  if (
    cap.executor.agent_id !== toolReq.agent_id ||
    cap.executor.agent_pubkey !== toolReq.agent_pubkey
  ) {
    res.json(deny("EXECUTOR_MISMATCH", cap.cap_id));
    return;
  }

  // 3. Check time
  const nowMs = Date.now();
  const expMs = Date.parse(cap.expires_at);
  if (!Number.isFinite(expMs)) {
    res.json(deny("BAD_CAPABILITY_TIME", cap.cap_id));
    return;
  }
  if (expMs < nowMs) {
    res.json(deny("CAP_EXPIRED", cap.cap_id));
    return;
  }
  if (cap.not_before) {
    const nbMs = Date.parse(cap.not_before);
    if (!Number.isFinite(nbMs)) {
      res.json(deny("BAD_CAPABILITY_TIME", cap.cap_id));
      return;
    }
    if (nbMs > nowMs) {
      res.json(deny("CAP_NOT_YET_VALID", cap.cap_id));
      return;
    }
  }

  // 4. Check revocation
  if (isRevoked(cap.cap_id)) {
    res.json(deny("REVOKED", cap.cap_id));
    return;
  }

  // 5. Check action type
  if (!cap.actions.includes("tool_call")) {
    res.json(deny("ACTION_NOT_ALLOWED", cap.cap_id));
    return;
  }

  // 6. Narrow constraints to tool_call type
  if (!isToolCallConstraints(cap.constraints)) {
    res.json(deny("ACTION_NOT_ALLOWED", cap.cap_id));
    return;
  }
  const constraints = cap.constraints;

  // 7. Check tool is allowed
  if (!constraints.allowed_tools.includes(toolReq.tool_name)) {
    res.json(deny("TOOL_NOT_ALLOWED", cap.cap_id));
    return;
  }

  // 8. Check tool category not blocked
  if (constraints.blocked_tool_categories.includes(toolReq.tool_category)) {
    res.json(deny(`TOOL_CATEGORY_BLOCKED:${toolReq.tool_category}`, cap.cap_id));
    return;
  }

  // --- Allow ---
  const receipt = emitReceipt({
    event: "ACTION_ALLOWED",
    request_id: toolReq.request_id,
    agent_id: toolReq.agent_id,
    cap_id: cap.cap_id,
    summary: {},
    meta: {
      action: "tool_call",
      tool_name: toolReq.tool_name,
      tool_category: toolReq.tool_category,
    },
  });

  const result: ActionResult = {
    request_id: toolReq.request_id,
    decision: "allow",
    reason: "ALLOWED",
    receipt_id: receipt.receipt_id,
  };
  res.json(result);
});

// -----------------------------------------------------------------------------
// POST /capability/revoke
// -----------------------------------------------------------------------------

const RevokeInputSchema = z
  .object({
    cap_id: z.string().min(8).max(128),
  })
  .strict();

app.post("/capability/revoke", (req, res) => {
  const parsed = RevokeInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    return;
  }

  const { cap_id } = parsed.data;

  // Check if capability exists
  const cap = getCap(cap_id);
  if (!cap) {
    res.status(404).json({ error: "CAP_NOT_FOUND", cap_id });
    return;
  }

  // Check if already revoked
  if (isRevoked(cap_id)) {
    res.status(400).json({ error: "ALREADY_REVOKED", cap_id });
    return;
  }

  // Revoke the capability
  revokeCap(cap_id);

  // Emit revocation receipt
  emitReceipt({
    event: "CAP_REVOKED",
    cap_id,
    agent_id: cap.executor.agent_id,
    summary: {},
  });

  res.json({
    success: true,
    cap_id,
    message: "Capability revoked. All further actions will be denied.",
  });
});

// -----------------------------------------------------------------------------
// GET /receipts
// -----------------------------------------------------------------------------

app.get("/receipts", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  res.json(getReceipts(limit, since));
});

// -----------------------------------------------------------------------------
// GET /capabilities (list active capabilities)
// -----------------------------------------------------------------------------

app.get("/capabilities", (_req, res) => {
  const caps = getAllCaps();

  // Filter out revoked, include revocation status
  const result = caps.map((cap) => ({
    ...cap,
    is_revoked: isRevoked(cap.cap_id),
  }));

  res.json(result);
});

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[proxy] listening on http://localhost:${PORT}`);
  console.log("");
  console.log("  CapNet services ready!");
  console.log("");
  console.log("  Next steps:");
  console.log("    Run the demo (new terminal):  npm run demo:clean");
  console.log("    Load Chrome extension:        chrome://extensions -> Load unpacked -> extension/dist/");
  console.log("");
});
