# CapNet Test Runbook

> Manual testing procedures for Phase 0. Run before demos and after significant changes.

---

## Demo Readiness Checklist

### GREEN — Safe to demo

- [ ] `npm run dev` starts without errors
- [ ] `curl http://127.0.0.1:3100/health` returns `{"status":"ok"}`
- [ ] `curl http://127.0.0.1:3200/health` returns `{"status":"ok"}`
- [ ] Extension shows "Connected to proxy" (green indicator)
- [ ] Extension shows agent identity (ID + pubkey)
- [ ] Can issue capability from Templates tab
- [ ] Active Caps shows new capability with correct constraints
- [ ] `npm run demo` completes all 9 steps successfully
- [ ] Receipts tab shows timeline with correct events

### RED — Must fix before demo

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Proxy won't start | Port 3100 in use | Kill other process or change PORT env |
| Extension shows "Cannot connect" | Proxy not running | Start with `npm run dev` |
| "Agent identity failed" | Chrome storage issue | Clear extension data, reload |
| Capability issuance fails | Shared not built | Run `npm run build:shared` |
| Demo script errors | Wrong agent pubkey | Run `npm run demo:clean` first |
| Receipts empty | Proxy restarted without data | Expected if fresh start |
| EXECUTOR_MISMATCH on all actions | Keypair rotated | Issue new capability |
| Extension won't load | Build stale | Run `npm run build:extension` |

### Pre-Demo Quick Check (2 minutes)

```bash
npm run demo:clean           # Fresh state
npm run dev &                # Start services (background)
sleep 5                      # Wait for startup
curl -s http://127.0.0.1:3100/health | grep -q '"ok"' && echo "Proxy: OK" || echo "Proxy: FAIL"
curl -s http://127.0.0.1:3200/health | grep -q '"ok"' && echo "Sandbox: OK" || echo "Sandbox: FAIL"
npm run demo                 # Should complete all 9 steps
```

If all steps pass → **GREEN, safe to demo.**

---

## Prerequisites

### Environment Setup

```bash
cd /path/to/CapNET
nvm use                    # Node 18.x
npm install
npm run build              # Build shared + extension
```

### Platform Compatibility

All scripts are cross-platform (Windows, macOS, Linux). **Important:** Install and run from the same environment.

| Issue | Solution |
|-------|----------|
| `@esbuild` platform error | Delete `node_modules`, run `npm install` from the same platform you'll run from |
| `npm run build` fails | Run `npm install` again — may need fresh install after platform switch |
| Demo shows stale results | Run `npm run demo:clean` to clear old data |

**Verified working on:** Windows 11 (PowerShell), WSL2 (Ubuntu), macOS

### Start Services

```bash
npm run dev                # Terminal 1: proxy (3100) + sandbox (3200)
```

### Load Extension

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `extension/dist/`
4. Pin the CapNet extension to toolbar

### Clear State (Fresh Start)

```bash
npm run demo:clean         # Removes data/*.json and data/*.jsonl
```

---

## Test 1: Health Check

**Purpose:** Verify all services are running.

### Steps

```bash
curl http://127.0.0.1:3100/health
curl http://127.0.0.1:3200/health
```

### Expected Results

```json
// Proxy
{"status":"ok","service":"capnet-proxy","version":"0.1.0","timestamp":"..."}

// Sandbox
{"status":"ok","service":"capnet-sandbox","version":"0.1.0","timestamp":"..."}
```

### Extension Check

1. Click extension icon
2. Should show "Connected to proxy" (green indicator)
3. If red/error, check proxy is running on 3100

---

## Test 2: Agent Identity

**Purpose:** Verify real Ed25519 keypair generation and persistence.

### Steps

1. Click extension icon
2. Go to "Templates" tab
3. Observe "Agent Identity" panel

### Expected Results

- Agent ID shown (e.g., `agent:demo-grocerybot`)
- Pubkey shown (truncated, e.g., `abc123def456...`)
- "Created" date displayed
- Copy button works (copies full pubkey to clipboard)

### Test Edit Agent ID

1. Click "Edit" next to Agent ID
2. Try invalid format: `invalid` → should show error
3. Try valid format: `agent:test-bot` → should save
4. Refresh extension → ID should persist

### Test Reset Keypair

1. Click "▶ Advanced" to expand
2. Copy current pubkey
3. Click "Generate New Keypair" → confirm dialog
4. Pubkey should change (compare to copied value)
5. "Created" date should update

---

## Test 3: Capability Issuance

**Purpose:** Verify capability creation with proper signing.

### Steps

1. Click extension icon → Templates tab
2. Click "Groceries" template
3. Set budget to $50
4. Ensure all category blocks are checked (alcohol, tobacco, gift cards)
5. Click "Issue Capability"

### Expected Results

- Success → redirects to Templates list
- "Active Caps" tab shows new capability with:
  - Agent ID: `agent:demo-grocerybot` (or your agent ID)
  - Budget: $50.00
  - Vendors: sandboxmart
  - Blocked: alcohol, tobacco, gift_cards
  - Status: "Active" (green)
  - "Expires in 23h 59m" (or similar)

### Verify via API

```bash
curl http://127.0.0.1:3100/capabilities | jq
```

Should show capability with:
- `cap_id`: starts with `cap_`
- `executor.agent_pubkey`: matches extension pubkey
- `constraints.max_amount_cents`: 5000
- `proof.sig`: non-empty base64

---

## Test 4: Allowed Action (Groceries)

**Purpose:** Verify permitted actions succeed.

### Steps

```bash
npm run demo
```

Or manually:

```bash
# Get catalog
curl http://127.0.0.1:3200/catalog | jq

# Validate cart (groceries only)
curl -X POST http://127.0.0.1:3200/cart/validate \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent:demo-grocerybot",
    "agent_pubkey": "<YOUR_PUBKEY>",
    "cart": [
      {"sku": "GROC-001", "qty": 2},
      {"sku": "GROC-002", "qty": 1}
    ]
  }'

# Submit to proxy (use action_request from above response)
curl -X POST http://127.0.0.1:3100/action/request \
  -H "Content-Type: application/json" \
  -d '<action_request_from_above>'
```

### Expected Results

```json
{
  "request_id": "req_...",
  "decision": "allow",
  "reason": "ALLOWED",
  "receipt_id": "rcpt_..."
}
```

### Verify in Extension

- Receipts tab shows "Action Allowed" (green) with amount and item count

---

## Test 5: Denied Action (Blocked Category)

**Purpose:** Verify category blocking works.

### Steps

```bash
# Validate cart with alcohol
curl -X POST http://127.0.0.1:3200/cart/validate \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent:demo-grocerybot",
    "agent_pubkey": "<YOUR_PUBKEY>",
    "cart": [
      {"sku": "ALC-001", "qty": 1}
    ]
  }'

# Submit to proxy
curl -X POST http://127.0.0.1:3100/action/request \
  -H "Content-Type: application/json" \
  -d '<action_request_from_above>'
```

### Expected Results

```json
{
  "request_id": "req_...",
  "decision": "deny",
  "reason": "CATEGORY_BLOCKED:alcohol",
  "receipt_id": "rcpt_..."
}
```

### Verify in Extension

- Receipts tab shows "Action Denied" (red) with reason "Category blocked: alcohol"

---

## Test 6: Denied Action (Budget Exceeded)

**Purpose:** Verify budget enforcement.

### Steps

1. Issue capability with $10 budget
2. Attempt purchase totaling > $10

```bash
curl -X POST http://127.0.0.1:3200/cart/validate \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent:demo-grocerybot",
    "agent_pubkey": "<YOUR_PUBKEY>",
    "cart": [
      {"sku": "GROC-001", "qty": 10}
    ]
  }'
```

### Expected Results

```json
{
  "decision": "deny",
  "reason": "AMOUNT_EXCEEDS_MAX"
}
```

---

## Test 7: Denied Action (Wrong Vendor)

**Purpose:** Verify vendor allowlisting.

### Steps

Modify action request to use different vendor:

```bash
curl -X POST http://127.0.0.1:3100/action/request \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req_test",
    "ts": "2026-02-10T12:00:00Z",
    "agent_id": "agent:demo-grocerybot",
    "agent_pubkey": "<YOUR_PUBKEY>",
    "vendor": "other-store",
    "cart": [{"sku": "X", "name": "Test", "category": "grocery", "price_cents": 100, "qty": 1}]
  }'
```

### Expected Results

```json
{
  "decision": "deny",
  "reason": "VENDOR_NOT_ALLOWED"
}
```

---

## Test 8: Revocation

**Purpose:** Verify capability revocation and post-revoke denial.

### Steps

1. Note a capability ID from Active Caps tab
2. Click "Revoke" button on that capability
3. Confirm the revocation

### Expected Results

- Capability status changes to "Revoked" (red)
- Revoke button disabled

### Verify via API

```bash
curl http://127.0.0.1:3100/capabilities | jq '.[] | select(.is_revoked == true)'
```

### Test Post-Revoke Action

```bash
# Attempt action with revoked capability
curl -X POST http://127.0.0.1:3100/action/request \
  -H "Content-Type: application/json" \
  -d '<action_request_for_revoked_cap>'
```

### Expected Results

```json
{
  "decision": "deny",
  "reason": "REVOKED"
}
```

### Verify in Extension

- Receipts tab shows:
  - "Capability Revoked" event
  - "Action Denied" with reason "Capability has been revoked"

---

## Test 9: Executor Mismatch

**Purpose:** Verify agent identity binding enforcement.

### Steps

1. Issue capability to current agent identity
2. In extension, go to Advanced → "Generate New Keypair"
3. Attempt action with old capability (now bound to old pubkey)

### Expected Results

```json
{
  "decision": "deny",
  "reason": "EXECUTOR_MISMATCH"
}
```

### Alternative: Manual Test

```bash
# Use capability but with different agent_pubkey in request
curl -X POST http://127.0.0.1:3100/action/request \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req_test",
    "ts": "2026-02-10T12:00:00Z",
    "agent_id": "agent:demo-grocerybot",
    "agent_pubkey": "DIFFERENT_PUBKEY_HERE_BASE64==",
    "vendor": "sandboxmart",
    "cart": [{"sku": "GROC-001", "name": "Milk", "category": "grocery", "price_cents": 499, "qty": 1}]
  }'
```

---

## Test 10: Expiration

**Purpose:** Verify time semantics enforcement.

### Note

Capabilities expire after 24 hours by default. To test expiration without waiting:

1. Manually edit `data/caps.json`
2. Set `expires_at` to a past timestamp
3. Attempt action

### Expected Results

```json
{
  "decision": "deny",
  "reason": "CAP_EXPIRED"
}
```

---

## Test 11: Receipts Timeline

**Purpose:** Verify audit trail completeness.

### Steps

1. Perform several actions (issue, allow, deny, revoke)
2. Click extension → Receipts tab

### Expected Results

- Events grouped by date
- Each event shows:
  - Icon and label (Capability Issued, Action Allowed, etc.)
  - Timestamp
  - Agent ID
  - Vendor (for actions)
  - Amount and item count (for actions)
  - Cap ID (truncated)
  - Request ID (for actions)
  - Denial reason (for denied actions)

### Verify via API

```bash
curl "http://127.0.0.1:3100/receipts?limit=20" | jq
```

---

## Test 12: SDK Demo Script

**Purpose:** End-to-end automated test.

### Steps

```bash
npm run demo:clean    # Fresh state
npm run demo          # Run full demo
```

### Expected Output

The demo runs 9 steps and ends with a summary. Key checkpoints:

| Step | What Happens | Expected |
|------|--------------|----------|
| 3 | Issue capability | Cap ID printed, $50 budget, blocked categories listed |
| 4 | Fetch catalog | Vendor: sandboxmart, Items: 16 |
| 5 | Grocery cart | Decision: ALLOW, order ID printed |
| 6 | Alcohol attempt | Decision: DENY, Reason: CATEGORY_BLOCKED:alcohol |
| 7 | Revoke capability | "Revoked: cap_..." |
| 8 | Post-revoke attempt | Decision: DENY, Reason: REVOKED |
| 9 | Audit trail | 8 events sorted oldest→newest (includes ACTION_ATTEMPT entries) |

**Final summary should show:**
```
  ✓ Groceries allowed (within budget, allowed vendor)
  ✗ Alcohol denied (blocked category)
  ✗ Post-revoke denied (capability revoked)

The leash works. Agents can act, but only within bounds.
```

### Deterministic Runs

For easier comparison between runs, set a seed:

```bash
CAPNET_DEMO_SEED=test1 npm run demo
```

The seed is displayed at the start of output for reference.

---

## Test 13: Extension Error States

**Purpose:** Verify graceful error handling.

### Proxy Down

1. Stop proxy (Ctrl+C on `npm run dev`)
2. Click extension
3. Should show "Cannot connect to proxy" (red indicator)
4. Click "Retry" button
5. Start proxy
6. Click "Retry" → should reconnect

### Invalid Agent ID

1. Edit Agent ID to invalid format (e.g., `bad`)
2. Should show inline error: "Format: agent:[a-z0-9._:-]{3,64}"

### Network Timeout

1. Slow/block network to proxy
2. Actions should timeout with "Request timed out" error

---

## Test 14: Persistence

**Purpose:** Verify state survives restarts.

### Steps

1. Issue capability
2. Stop proxy (Ctrl+C)
3. Restart proxy (`npm run dev`)
4. Check capabilities still exist

```bash
curl http://127.0.0.1:3100/capabilities | jq
```

### Verify Revocation Persists

1. Revoke a capability
2. Restart proxy
3. Attempt action with revoked cap → should still be denied

### Verify Agent Identity Persists

1. Note agent pubkey in extension
2. Close and reopen Chrome
3. Click extension → pubkey should be same

---

## Test 15: Signature Verification

**Purpose:** Verify invalid signatures are rejected.

### Steps

Tamper with capability signature:

```bash
# Get a valid action request
curl -X POST http://127.0.0.1:3200/cart/validate \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent:demo-grocerybot",
    "agent_pubkey": "<VALID_PUBKEY>",
    "cart": [{"sku": "GROC-001", "qty": 1}]
  }'

# Manually edit caps.json to corrupt proof.sig
# Then submit action
```

### Expected Results

```json
{
  "decision": "deny",
  "reason": "BAD_SIGNATURE"
}
```

---

## Quick Smoke Test (5 minutes)

For rapid verification after changes:

1. `npm run demo:clean && npm run dev` (Terminal 1)
2. `npm run build:extension` (Terminal 2)
3. Reload extension in Chrome
4. Click extension → verify "Connected"
5. Issue Groceries capability ($50)
6. Check Active Caps → shows new cap
7. `npm run demo` → all 9 steps pass
8. Check Receipts → shows all events

---

## Test Matrix

| Test | Component | Expected | Priority |
|------|-----------|----------|----------|
| Health endpoints | Proxy, Sandbox | 200 OK | P0 |
| Agent identity gen | Extension | Real Ed25519 | P0 |
| Capability issuance | Proxy, Extension | Signed CapDoc | P0 |
| Allowed action | Proxy | decision: allow | P0 |
| Category block | Proxy | CATEGORY_BLOCKED | P0 |
| Budget exceeded | Proxy | AMOUNT_EXCEEDS_MAX | P0 |
| Vendor mismatch | Proxy | VENDOR_NOT_ALLOWED | P1 |
| Revocation | Proxy | REVOKED | P0 |
| Post-revoke denial | Proxy | REVOKED | P0 |
| Executor mismatch | Proxy | EXECUTOR_MISMATCH | P0 |
| Expiration | Proxy | CAP_EXPIRED | P1 |
| Receipts display | Extension | Timeline shown | P0 |
| SDK demo | SDK | All steps pass | P0 |
| Persistence | Proxy | State survives restart | P1 |
| Signature verify | Proxy | BAD_SIGNATURE on tamper | P1 |

---

## Testing Tiers

### Tier 1: Deterministic Script (REQUIRED)

All testers must complete Tier 1 using `npm run demo` before any other testing.

**Why?** LLM agents are nondeterministic. Prove the rails work with repeatable tests first.

| Test | Agent | Required |
|------|-------|----------|
| Tests 1-15 in this runbook | `sdk/src/demo.ts` | Yes |
| Extension UI tests | Manual | Yes |

### Tier 2: LLM Agent (OPTIONAL)

Only after Tier 1 passes 100%:

| Agent Type | Setup | Purpose |
|------------|-------|---------|
| LLM CLI shim | Local script + OpenAI/Anthropic | Realistic agent behavior |
| Browser agent | Extension-mediated | Future work |

**Rule:** LLM proposes actions, CapNet decides. Agent never sees credentials.

---

## Known Issues / Limitations

1. **Bundle size**: Extension is ~328KB due to Zod inclusion (acceptable for demo)
2. **No delegation yet**: Attenuation/sub-capabilities not implemented
3. **Single agent per extension**: Multi-agent management is future work
4. **Local proxy only**: No remote proxy configuration yet

## Verified Test Results (2026-02-18)

All core scenarios verified on WSL2 (Ubuntu) and Windows 11:

```
============================================================
CapNet Demo Agent — Capability Lifecycle
============================================================

[3] Wallet issuing capability to agent...
    Cap ID: cap_1771456531906_5776a25b
    Budget: $50.00

[5] Building grocery cart (should be ALLOWED)...
    Total: $14.47
    Decision: ALLOW ✓

[6] Attempting to buy alcohol (should be DENIED)...
    Decision: DENY ✓
    Reason: CATEGORY_BLOCKED:alcohol

[7] Revoking capability...
    Revoked: cap_1771456531906_5776a25b ✓

[8] Attempting groceries after revoke (should be DENIED)...
    Decision: DENY ✓
    Reason: REVOKED

============================================================
Demo Summary
============================================================
  ✓ Groceries allowed (within budget, allowed vendor)
  ✗ Alcohol denied (blocked category)
  ✗ Post-revoke denied (capability revoked)
============================================================
```

---

## Reporting Issues

When reporting test failures, include:

1. Test number and name
2. Steps taken
3. Expected vs actual result
4. Console errors (browser dev tools, terminal)
5. Contents of `data/` files if relevant
