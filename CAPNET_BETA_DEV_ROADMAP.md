# CapNet Phase 0 — Beta Demo Dev Roadmap

> **Mission:** Build the capability layer that lets agents take real actions safely.
>
> **Phase 0 Goal:** Prove the primitive works with an investor-grade demo.

---

## 0) Summary

This roadmap builds Phase 0: **Agent Sandbox Wallet + Proxy** — a working demonstration that enforceable, revocable, template-driven delegation works *today* without external partnerships.

**The thesis:** CapNet is not a product. It's a new fundamental layer for the agentic era — the trust and permission fabric that makes machine actors governable.

**Phase 0 proves:** The leash works. Capabilities are scoped, time-bounded, revocable, and auditable.

---

## 1) Delivery Mechanism

**Browser extension + local sidecar proxy + merchant sandbox**

Why this architecture:
- Fastest path to a legible demo
- No OpenAI/Anthropic partnership required
- No merchant changes required
- Proxy is the enforcement boundary — instant revoke + receipts
- Extension is the wallet UI — template management + capability oversight

---

## 2) Tech Stack (implemented)

| Component | Stack | Port |
|-----------|-------|------|
| **shared/** | TypeScript, Zod schemas, Ed25519 (tweetnacl) | — |
| **proxy/** | Node.js/Express, file-based persistence | 3100 |
| **sandbox/** | Node.js/Express, in-memory catalog/orders | 3200 |
| **extension/** | Chrome MV3, React, Webpack | — |
| **sdk/** | TypeScript client library | — |

**Key decisions:**
- Ed25519 signatures with domain separation
- JSONL append-only receipts (audit trail)
- Atomic file writes (crash-safe)
- Protocol-grade Zod schemas with strict validation

---

## 3) Phase 0 Product Requirements

### A) Wallet / Extension UI (✅ COMPLETE)
- [x] Templates list (Groceries template)
- [x] Template detail: budget, allowed vendors, blocked categories
- [x] Generate capability → POST to proxy
- [x] Active capabilities list with status
- [x] Revoke button → POST /capability/revoke
- [x] Receipts timeline view
- [x] Agent identity management (Ed25519 keypair, persisted to chrome.storage)

### B) Proxy / Enforcement Boundary (✅ COMPLETE)
- [x] Capability issuance (POST /capability/issue)
- [x] Capability validation (signature, expiry, executor binding)
- [x] Constraint enforcement (budget, vendor, category, time)
- [x] Revocation (POST /capability/revoke, persisted)
- [x] Receipts emission (ACTION_ATTEMPT, ALLOWED, DENIED, CAP_ISSUED, CAP_REVOKED)
- [x] Deterministic cap selection (newest first)

### C) Merchant Sandbox (✅ COMPLETE)
- [x] GET /catalog — 16 items across grocery, alcohol, gift_cards, tobacco, household
- [x] POST /cart/validate — returns ActionRequest payload for proxy
- [x] POST /checkout — creates order after proxy approval
- [x] GET /orders — list/retrieve orders

### D) SDK (✅ COMPLETE)
- [x] Health check
- [x] Issue capability
- [x] Submit action request
- [x] Revoke capability
- [x] List capabilities
- [x] List receipts
- [x] Full lifecycle demo script (`sdk/src/demo.ts`)

---

## 4) Timeline (6 weeks, demo-first)

### Week 1 — Skeleton + Interfaces ✅ COMPLETE
- Repo scaffold with workspaces
- Proxy + sandbox health endpoints
- Extension loads in Chrome
- Draft CapDoc v0.1 + ActionRequest schemas

### Week 2 — Schemas + Crypto ✅ COMPLETE
- Protocol-grade Zod schemas (strict, validated)
- Ed25519 signing with domain separation
- Browser-safe base64
- Types compile across all workspaces

### Week 3 — Enforcement + Sandbox ✅ COMPLETE
- Full proxy enforcement (all constraint types)
- Sandbox catalog with blocked categories
- Cart validation → ActionRequest generation
- Receipts emission on all actions

### Week 4 — Revocation ✅ COMPLETE
- POST /capability/revoke endpoint
- Persisted revocation (survives restart)
- Post-revoke attempts denied
- CAP_REVOKED receipt event

### Week 5 — Extension UI ✅ COMPLETE
- Templates screen with template config + issuance
- Agent identity panel (Ed25519 keypair generation/persistence)
- Active capabilities list with revoke button
- Receipts timeline grouped by date
- Response schema validation (Zod) on all API calls

### Week 6 — Polish + Demo Harness (PARTIAL)
- [x] Human-readable denial reasons
- [x] One command to run all components (`npm run dev`)
- [x] Demo script with full lifecycle (`npm run demo:clean`)
- [x] Post-demo and post-startup next-step guidance
- [ ] "Investor Mode" scripted flow
- [ ] Conformance tests

---

## 5) API Specification (Phase 0)

### Proxy Endpoints (port 3100)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/capability/issue` | Issue new capability |
| POST | `/action/request` | Request action (enforces constraints) |
| POST | `/capability/revoke` | Revoke capability by ID |
| GET | `/capabilities` | List all capabilities |
| GET | `/receipts` | Query receipt log |

### Sandbox Endpoints (port 3200)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/catalog` | Get product catalog |
| POST | `/cart/validate` | Validate cart, return ActionRequest |
| POST | `/checkout` | Create order (after approval) |
| GET | `/orders` | List all orders |
| GET | `/orders/:id` | Get order by ID |

### Example ActionRequest
```json
{
  "request_id": "req_1707350400000_a1b2c3d4",
  "ts": "2026-02-08T12:00:00.000Z",
  "agent_id": "agent:grocerybot",
  "agent_pubkey": "base64-encoded-32-byte-ed25519-pubkey",
  "action": "spend",
  "vendor": "sandboxmart",
  "currency": "USD",
  "cart": [
    {"sku": "GRO-001", "name": "Organic Milk", "category": "grocery", "price_cents": 599, "qty": 1}
  ]
}
```

### Example ActionResult
```json
{
  "request_id": "req_1707350400000_a1b2c3d4",
  "decision": "allow",
  "reason": "ALLOWED",
  "receipt_id": "rcpt_1707350400123_e5f6g7h8"
}
```

### Denial Reasons
- `NO_CAPABILITY` — No matching capability for agent
- `REVOKED` — Capability has been revoked
- `CAP_EXPIRED` — Capability past expiry
- `CAP_NOT_YET_VALID` — Capability not_before is in future
- `BAD_SIGNATURE` — Capability signature invalid
- `BAD_CAPABILITY_TIME` — Capability has unparseable timestamps
- `EXECUTOR_MISMATCH` — Agent ID/pubkey doesn't match capability
- `VENDOR_NOT_ALLOWED` — Vendor not in allowed_vendors
- `CATEGORY_BLOCKED:<category>` — Item category is blocked
- `AMOUNT_EXCEEDS_MAX` — Cart total exceeds budget

---

## 6) Definition of Done (Beta Demo)

The demo is successful when:
- [ ] Non-technical viewer understands without explanation
- [ ] Allowed purchase completes end-to-end
- [ ] Forbidden purchase blocked with clear reason
- [ ] Revoke instantly kills authority
- [ ] Receipts show audit trail
- [ ] Agent never sees raw credentials
- [ ] Demo runs 10/10 times reliably

---

## 7) The Ladder (Post-Phase 0)

1. **Agent Permission Broker** (Phase 0-1)
   - Issue time-bound, scope-bound capabilities
   - Step-up approval for high-risk actions
   - Full audit trail
   - **Phase 1 integration target: OpenClaw** — 140K GitHub stars, documented security issues (Cisco found data exfiltration in skills), maintainer warning "too dangerous for beginners." Perfect proof that CapNet solves a real, documented problem. Three integration approaches: CapNet skill, proxy middleware, or MCP gateway.

2. **Transport-Agnostic Enforcement** (Phase 1-2)
   - Agents act via multiple transports: API/tool calling (~80%), MCP (growing fast), browser automation (~15%), desktop/OS (~5%), CLI (niche)
   - Same enforcement pipeline regardless of transport — adapters per method
   - **MCP as strategic inflection point**: CapNet as MCP gateway wrapping MCP servers. Agent connects to CapNet thinking it's the MCP server; CapNet enforces policy, then forwards to the real server. "Install and forget" enforcement.

3. **Agent-to-SaaS Policy Layer** (Phase 2)
   - Normalize permissions across common SaaS
   - Enforce least privilege across tools
   - MCP gateway for tool-calling agents

4. **Cross-org Delegated Trust** (Phase 3)
   - One org grants another org's agents scoped capabilities
   - No raw credential sharing

5. **Universal Capability Fabric** (North Star)
   - The default way networks express trust and collaboration
   - "TCP/IP of agency"

**Important distinction:** CapNet is NOT a firewall. It doesn't monitor all traffic or restrict the human user. It's a fence for the agent — scoped authority for the machine actor, invisible to the human. "Power of attorney with limits."

---

## 8) Key Risks & Watch Items

1. **Developer experience will make or break adoption.** The paradigm wins if a single engineer can wire up CapNet in an afternoon without asking permission.

2. **The demo needs to feel inevitable, not clever.** Investors should think "of course this is how it should work."

3. **First 3-5 real integrations matter.** After sandbox, show CapNet gating something real (payment rail, SaaS API).

4. **Brand collision is real.** "CapNet" has name conflicts. Address before major public launch.
