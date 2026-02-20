# CapNet

Capability-based authorization layer for AI agents. Leash, not master keys.

## The 1-Minute Pitch

- **We don't give agents credentials.** We mint capabilities — bounded scope, time, vendors, budget.
- **Every risky action routes through a policy enforcement boundary.** The agent never sees raw credentials.
- **If it goes wrong, we can prove what happened and kill it instantly.** Full audit trail, immediate revocation.

## What CapNet is NOT

- **Not a firewall.** A firewall monitors all traffic. CapNet only governs the agent. The human can still do whatever they want — it's a fence for the agent, not a cage for the user.
- **Not surveillance or DLP.** We don't watch your browsing, scan your data, or filter your content.
- **Not a prompt-based restriction.** We don't ask the AI "please don't buy alcohol." The agent can try anything — the enforcement proxy blocks what the capability doesn't allow.
- **Not a payments company.** Spending is the demo wedge, not the product.
- **Not an LLM wrapper.** We're infrastructure that works with any agent framework.
- **Not another IAM UI.** We're the authorization primitive that IAM systems will call.
- **Not blockchain.** Cryptographic signatures, not distributed consensus.

## For Testers

New to the project? Start here: **[TESTER_GUIDE.md](TESTER_GUIDE.md)** — Complete guide with setup, scenarios, and FAQ.

Quick reference: [TESTING_QUICKSTART.md](TESTING_QUICKSTART.md) | Full runbook: [TEST_RUNBOOK.md](TEST_RUNBOOK.md)

---

## Demo in 5 Steps

1. **User sets policy** → "Groceries, $200 max, block alcohol" (extension UI)
2. **System mints capability** → Signed, time-bounded, executor-bound (proxy)
3. **Agent shops** → Checkout succeeds within constraints (sandbox + proxy)
4. **Agent tries forbidden item** → Blocked with clear reason (proxy)
5. **User revokes** → All further actions denied instantly (proxy + receipts)

## Quick Start

```bash
nvm use          # Node 18
npm install
npm run dev      # Starts proxy (3100) + sandbox (3200)
```

**Platform:** Cross-platform (Windows, macOS, Linux). If using WSL, run `npm install` from WSL (not Windows) to get the correct native binaries.

## Build & Load Extension

```bash
npm run build:extension
# Load extension/dist/ as unpacked extension in Chrome (chrome://extensions)
```

## Run Demo Script

```bash
npm run demo     # Full lifecycle: issue → allow → deny → revoke → deny
```

## Project Structure

```
shared/      @capnet/shared     — Zod schemas, TS types, Ed25519 crypto
proxy/       @capnet/proxy      — Enforcement proxy (port 3100)
sandbox/     @capnet/sandbox    — Merchant simulator (port 3200)
sdk/         @capnet/sdk        — Client SDK + demo script
extension/   @capnet/extension  — Chrome MV3 wallet UI
data/        Runtime storage    — Keys, caps, receipts (gitignored)
docs/        Spec & docs
```

## Architecture

```
Extension (Chrome MV3, React)
    ↕ HTTP (localhost:3100)
Proxy (Express, enforcement boundary)
    ↕ HTTP (localhost:3200)
Sandbox (Express, merchant simulator)
    ↕
SDK (client library for agents)
```

**Key principle:** The proxy is the sole enforcement boundary. Agents never receive raw credentials.

## What Works (Phase 0 Complete)

| Feature | Status |
|---------|--------|
| Capability issuance with Ed25519 signatures | Working |
| Budget enforcement (max_amount_cents) | Working |
| Vendor allowlisting | Working |
| Category blocking (alcohol, tobacco, gift_cards) | Working |
| Time semantics (expires_at, not_before) | Working |
| Executor binding (agent pubkey) | Working |
| Revocation with persistence | Working |
| Audit trail (receipts) | Working |
| Wallet UI (templates, caps, receipts) | Working |
| Real agent identity (Ed25519 keypair) | Working |

## TypeScript Configuration

Security-grade TypeScript with strict settings:

- `noUncheckedIndexedAccess` — Array/object indexing returns `T | undefined`
- `exactOptionalPropertyTypes` — Optional properties can't be explicitly `undefined`
- `useUnknownInCatchVariables` — Catch variables typed as `unknown`
- `noImplicitOverride` — Requires explicit `override` keyword

## Scripts

```bash
npm run dev           # Start proxy + sandbox
npm run demo          # Run SDK demo script
npm run demo:clean    # Clear data/ and run demo
npm run build         # Build shared + extension
npm run typecheck     # Typecheck proxy, sandbox, sdk
npm run typecheck:all # Typecheck all + build extension
```

## Testing the Demo Story

1. **Start services:** `npm run dev`
2. **Load extension:** Build and load `extension/dist/` in Chrome
3. **Issue capability:** Click "Groceries" template, set budget, issue
4. **Run demo:** `npm run demo` shows:
   - Groceries purchase: ALLOWED
   - Alcohol purchase: DENIED (category blocked)
   - Revoke capability
   - Any purchase: DENIED (revoked)
5. **View receipts:** Extension shows full audit trail

## Documentation

| Doc | Audience | Purpose |
|-----|----------|---------|
| `TESTER_GUIDE.md` | External testers | Complete guide: what, why, how, FAQ |
| `TESTING_QUICKSTART.md` | Testers | 5-minute setup (quick reference) |
| `TEST_RUNBOOK.md` | QA / Developers | Detailed test procedures |
| `CAPNET_CONTEXT.md` | Everyone | Vision, thesis, design principles |
| `WORKING_NOTES.md` | Developers | Session log, implementation status |
| `CapNet_Overview.docx` | Investors / Collaborators | 15-page overview with revenue model & GTM |
| `docs/spec_v0.1.md` | Developers | Technical specification |

## Status

**Phase 0 Complete** — Ready for testing. All core scenarios verified (2026-02-18).
