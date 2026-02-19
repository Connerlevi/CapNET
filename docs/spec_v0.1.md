# CapNet Specification v0.1

> **Status:** Implementation Draft
> **Version:** 0.1.0
> **Last Updated:** 2026-02-08

---

## 1. Overview

CapNet is a capability-based authorization layer for the agentic era. It provides scoped, time-bounded, revocable permissions that are enforced at a proxy boundary, ensuring agents can take real actions safely without receiving raw credentials.

**Core thesis:** The internet solved transport. AI is solving cognition. CapNet solves governable authority for machine actors.

---

## 2. Core Concepts

### 2.1 Capability (CapDoc)

A **CapDoc** is a cryptographically signed permission artifact that authorizes specific actions on a resource under constraints. Key properties:

- **Scoped** — Targeted to specific resources, vendors, and action types
- **Time-bounded** — Has `issued_at`, `expires_at`, and optional `not_before`
- **Revocable** — Can be killed instantly via revocation oracle
- **Composable** — Can delegate attenuated sub-capabilities (monotone reduction only)
- **Traceable** — Full audit trail via receipts

### 2.2 ActionRequest

A request from an agent to perform an action under a capability. Contains:
- Agent identity (ID + public key)
- Action type and vendor
- Cart items with categories and prices

### 2.3 ActionResult

The outcome of an action request:
- `allow` — Action permitted, includes receipt_id
- `deny` — Action blocked, includes reason code

### 2.4 Receipt

An immutable log entry recording an action attempt and its result. Events:
- `CAP_ISSUED` — Capability created
- `CAP_REVOKED` — Capability revoked
- `ACTION_ATTEMPT` — Agent requested action
- `ACTION_ALLOWED` — Action permitted
- `ACTION_DENIED` — Action blocked (includes reason)

### 2.5 Proxy (Enforcement Boundary)

The proxy is the sole enforcement point. It:
- Stores capabilities and revocation state
- Validates signatures before trusting cap fields
- Enforces all constraints
- Emits receipts for every action
- Never exposes raw credentials to agents

---

## 3. CapDoc Schema (v0.1)

```typescript
interface CapDoc {
  version: "capdoc/0.1";
  cap_id: string;                    // Unique identifier (8-128 chars)
  issued_at: string;                 // ISO 8601 datetime
  not_before?: string;               // ISO 8601 datetime (optional)
  expires_at: string;                // ISO 8601 datetime (must be > issued_at)

  issuer: {
    id: string;                      // e.g., "wallet:local"
    pubkey: string;                  // Ed25519 public key (base64, 32 bytes)
  };

  subject: {
    id: string;                      // e.g., "user:local"
  };

  executor: {
    agent_id: string;                // Agent identifier
    agent_pubkey: string;            // Ed25519 public key (base64, 32 bytes)
  };

  resource: {
    type: "spend" | "sandbox_merchant" | "generic";
    vendor: string;                  // Normalized, lowercase
  };

  actions: ("spend")[];              // Non-empty array

  constraints: {
    currency: "USD";
    max_amount_cents: number;        // Positive integer
    allowed_vendors: string[];       // Non-empty, must include resource.vendor
    blocked_categories: string[];    // Categories to deny
  };

  revocation: {
    mode: "strict" | "lease" | "one_time";
    oracle: "local_proxy";
  };

  proof: {
    alg: "ed25519";
    sig: string;                     // Ed25519 signature (base64, 64 bytes)
  };
}
```

### 3.1 Validation Rules

1. `expires_at` must be after `issued_at`
2. `not_before` (if present) must be ≤ `expires_at`
3. `allowed_vendors` must include `resource.vendor`
4. All schemas use `.strict()` to reject unknown fields
5. Public keys must be valid base64 encoding 32 bytes
6. Signatures must be valid base64 encoding 64 bytes

---

## 4. Signing

### 4.1 Algorithm

- **Algorithm:** Ed25519 (detached signatures)
- **Library:** tweetnacl (Node + browser compatible)

### 4.2 Domain Separation

Signatures include a domain prefix to prevent cross-protocol confusion:

| Object Type | Domain Prefix |
|-------------|---------------|
| CapDoc | `capnet:capdoc/0.1:` |
| Receipt | `capnet:receipt/0.1:` |
| ActionRequest | `capnet:actionrequest/0.1:` |

### 4.3 Canonicalization

Before signing, objects are canonicalized:

1. Remove the `proof` field (sign the unsigned payload)
2. Sort all object keys recursively (alphabetical)
3. Serialize to JSON (no whitespace)
4. Prepend domain prefix
5. Encode as UTF-8 bytes

```typescript
function signCapDoc(unsigned: Omit<CapDoc, "proof">, secretKey: string): string {
  const canonical = "capnet:capdoc/0.1:" + stableStringify(unsigned);
  const message = new TextEncoder().encode(canonical);
  return ed25519Sign(message, secretKey);
}
```

### 4.4 Verification Order

When verifying a capability:

1. **Verify signature first** — before trusting any fields
2. Check executor binding (agent_id + agent_pubkey match request)
3. Check time semantics (not expired, not before valid period)
4. Check revocation status
5. Check constraints (vendor, category, amount)

---

## 5. ActionRequest Schema

```typescript
interface ActionRequest {
  request_id: string;                // Unique identifier (8-128 chars)
  ts: string;                        // ISO 8601 datetime
  agent_id: string;                  // Must match cap executor
  agent_pubkey: string;              // Ed25519 pubkey (base64, 32 bytes)
  action: "spend";
  vendor: string;                    // Normalized, lowercase
  currency: "USD";
  cart: CartItem[];                  // Non-empty (1-100 items)
}

interface CartItem {
  sku?: string;
  name: string;
  category: string;                  // Normalized, lowercase
  price_cents: number;               // 1 to 5,000,000 (up to $50,000/item)
  qty: number;                       // 1 to 1,000
}
```

### 5.1 Validation

- Cart must have at least 1 item
- `price_cents * qty` must be a safe integer for each item
- Total cart amount must be a safe integer
- Vendor and categories are normalized (trimmed, lowercase)

---

## 6. ActionResult Schema

```typescript
interface ActionResult {
  request_id: string;                // Matches ActionRequest
  decision: "allow" | "deny";
  reason: string;                    // See denial reasons
  receipt_id: string;                // Links to stored receipt
}
```

### 6.1 Denial Reasons

| Reason | Description |
|--------|-------------|
| `ALLOWED` | Action permitted |
| `NO_CAPABILITY` | No matching capability for agent |
| `REVOKED` | Capability has been revoked |
| `CAP_EXPIRED` | Capability past expiry time |
| `CAP_NOT_YET_VALID` | Current time before not_before |
| `BAD_SIGNATURE` | Capability signature invalid |
| `BAD_CAPABILITY_TIME` | Unparseable timestamp in capability |
| `EXECUTOR_MISMATCH` | Agent doesn't match capability binding |
| `VENDOR_NOT_ALLOWED` | Vendor not in allowed_vendors |
| `CATEGORY_BLOCKED:<cat>` | Item category is blocked |
| `AMOUNT_EXCEEDS_MAX` | Cart total exceeds budget |

---

## 7. Receipt Schema

```typescript
interface Receipt {
  receipt_id: string;
  ts: string;                        // ISO 8601 datetime
  event: ReceiptEvent;
  cap_id?: string;                   // Required for CAP_* and ACTION_ALLOWED
  request_id?: string;               // Required for ACTION_* events
  agent_id?: string;                 // Required for ACTION_* events
  vendor?: string;
  summary: {
    amount_cents?: number;
    item_count?: number;
    denied_reason?: string;
  };
  meta: Record<string, JsonValue>;   // JSON-safe values only
  proof?: {
    alg: "ed25519";
    sig: string;
    signer_pubkey: string;
  };
}

type ReceiptEvent =
  | "ACTION_ATTEMPT"
  | "ACTION_ALLOWED"
  | "ACTION_DENIED"
  | "CAP_ISSUED"
  | "CAP_REVOKED";
```

### 7.1 Event Requirements

| Event | Required Fields |
|-------|-----------------|
| `CAP_ISSUED` | `cap_id` |
| `CAP_REVOKED` | `cap_id` |
| `ACTION_ATTEMPT` | `request_id`, `agent_id` |
| `ACTION_ALLOWED` | `request_id`, `agent_id`, `cap_id` |
| `ACTION_DENIED` | `request_id`, `agent_id` |

---

## 8. API Endpoints

### 8.1 Proxy (port 3100)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/capability/issue` | Issue new capability |
| POST | `/action/request` | Request action (enforcement) |
| POST | `/capability/revoke` | Revoke capability |
| GET | `/capabilities` | List all capabilities |
| GET | `/receipts` | Query receipt log |

### 8.2 Sandbox (port 3200)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/catalog` | Get product catalog |
| POST | `/cart/validate` | Validate cart, return ActionRequest |
| POST | `/checkout` | Create order |
| GET | `/orders` | List orders |
| GET | `/orders/:id` | Get order by ID |

---

## 9. Security Model

### 9.1 Assumptions

- Agents can be buggy or malicious
- Users can be tricked into overly broad grants
- Prompt injection and confused deputy attacks are inevitable

### 9.2 Protections (Phase 0)

- Budget enforcement (max_amount_cents)
- Vendor allow-list
- Category block-list
- Time windowing (expires_at, not_before)
- Instant revocation
- Full audit trail (receipts)
- Credential isolation (agent never sees raw creds)

### 9.3 Deferred (Post-Phase 0)

- Hardware/TEE attestation
- Cross-device key sync
- Nation-state attack resistance
- Coercion/duress recovery

---

## 10. Architecture

```
┌─────────────────┐
│   Extension     │  Wallet UI: templates, capabilities, receipts
│  (Chrome MV3)   │
└────────┬────────┘
         │ HTTP (localhost)
         ▼
┌─────────────────┐
│     Proxy       │  Enforcement boundary: issue, validate, revoke
│  (port 3100)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│ data/ │ │Sandbox│  Merchant simulator
│ store │ │ 3200  │
└───────┘ └───────┘
```

### 10.1 Data Files

| File | Format | Purpose |
|------|--------|---------|
| `caps.json` | JSON | Stored capabilities |
| `receipts.jsonl` | JSONL | Append-only audit log |
| `revoked.json` | JSON | Revoked cap IDs |
| `issuer_keys.json` | JSON | Proxy Ed25519 keypair |

---

## 11. Attenuation Rules

When delegating capabilities:

1. **Monotone reduction only** — derived caps can only reduce authority
2. Budget must be ≤ parent budget
3. Expiry must be ≤ parent expiry
4. Allowed vendors must be ⊆ parent allowed vendors
5. Blocked categories must be ⊇ parent blocked categories
6. Derived cap must include `parent_cap_id`

---

## 12. Future Considerations

### 12.1 Phase 1+

- Multiple action types (email, calendar, API calls)
- Step-up approval for high-risk actions
- Cross-org delegation
- Real payment rail integration

### 12.2 Protocol Evolution

- JCS (JSON Canonicalization Scheme) for signing
- Merkle receipt trees for scalable audit
- Distributed revocation oracles
- TEE-based key custody
