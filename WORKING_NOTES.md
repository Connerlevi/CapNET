# CapNet Phase 0 — Working Notes

> Session continuity document. Update after each work session.

---

## Last Updated: 2026-02-20

## Current Status: READY FOR TESTING — Extension popup fix pushed, OpenClaw identified as Phase 1 target

---

## The Thesis (keep top of mind)

**CapNet is the capability layer that lets agents take real actions safely, by enforcing scoped authority + policy gates + audit proofs across any tool.**

We're building paradigm-level infrastructure, not a product. The unit of authority for machine actors.

---

## Key Risks & Watch Items

1. **Developer experience will make or break adoption.** The paradigm wins if a single engineer can wire up CapNet in an afternoon without asking permission. That means the SDK and quickstart need to be ruthlessly simple. This isn't built yet.

2. **The demo needs to feel inevitable, not clever.** Investors and engineers should watch it and think "of course this is how it should work" — not "that's a neat trick." The spend sandbox is the right first demo, but the narrative framing matters.

3. **You'll need to pick your first 3-5 real integrations carefully.** After the sandbox demo, the next step is showing CapNet gating something people actually use (a real payment rail in test mode, or a real SaaS API). That's where "toy" becomes "infrastructure."

4. **The name collision is a real thing to solve before you push for mindshare.** Not urgent for Phase 0, but if you're thinking paradigm-level, owning the name matters.

---

## Prompt Completion Tracker

| Prompt | Description | Status | Notes |
|--------|-------------|--------|-------|
| 1 | Repo scaffold + stack | DONE | Monorepo, workspaces, health endpoints, extension loads |
| 2 | CapDoc v0.1 + Action schema | DONE | Schemas, Ed25519 crypto, types compile across workspaces |
| 3 | Wallet UI (templates + active caps) | DONE | Templates, Active Caps, Receipts tabs; issue/revoke working |
| 4 | Proxy enforcement boundary | DONE | Full enforcement: vendor, category, budget, time, executor |
| 5 | Sandbox + checkout + agent script | DONE | 17 item catalog, cart validation, checkout, orders API |
| 6 | Revocation + post-revoke denial | DONE | POST /capability/revoke, persisted, CAP_REVOKED receipts |
| 7 | Executor binding + attenuation | PARTIAL | Executor binding DONE; attenuation/delegation NOT STARTED |
| 8 | Demo polish + investor mode | NOT STARTED | |
| 9 | Conformance tests | NOT STARTED | |

---

## What Exists (verified 2026-02-10)

### shared/ (@capnet/shared)
- `src/schemas/capdoc.ts` — CapDoc v0.1 Zod schema (strict, cross-field validation)
- `src/schemas/action.ts` — ActionRequest, ActionResult, CartItem, DenyReason schemas
- `src/schemas/receipt.ts` — Receipt schema with JSON-safe meta, event validation
- `src/crypto.ts` — Ed25519 with domain separation, browser-safe base64, key length validation
- `src/index.ts` — Explicit barrel exports (no export *)
- `package.json` — Hardened: exports map, files, sideEffects:false, pinned deps, rimraf clean
- `dist/` — Compiled and ready for consumption

### proxy/ (@capnet/proxy) — port 3100
- `src/index.ts` — Express server with:
  - `GET /health` — working
  - `POST /capability/issue` — signs and stores CapDocs, emits CAP_ISSUED receipt
  - `POST /action/request` — full enforcement: vendor, category, budget, time, executor, signature
  - `POST /capability/revoke` — revokes cap, persists to revoked.json, emits CAP_REVOKED
  - `GET /capabilities` — lists all caps with is_revoked status
  - `GET /receipts` — query with limit/since params
- `src/store.ts` — File-based persistence with atomic writes, revocation persistence
- CORS configured for chrome-extension:// and localhost/127.0.0.1 origins
- Verification order: signature → executor → time → revocation → constraints

### sandbox/ (@capnet/sandbox) — port 3200
- `src/index.ts` — Express server with:
  - `GET /health` — working
  - `GET /catalog` — 16 items across grocery, alcohol, gift_cards, tobacco, household
  - `POST /cart/validate` — validates cart, returns ActionRequest payload
  - `POST /checkout` — creates order after proxy approval
  - `GET /orders` and `GET /orders/:id` — list/retrieve orders

### sdk/ (@capnet/sdk)
- `src/index.ts` — CapNetClient class with all proxy methods, AbortController timeouts
- `src/demo.ts` — Full lifecycle demo: issue → allow → deny → revoke → deny
  - Generates/loads real Ed25519 agent keypair (data/demo_agent_key.json)
  - Imports types from @capnet/shared (no drift)
  - Clear audit trail output

### extension/ (@capnet/extension)
- Chrome MV3 manifest (permissions: storage, host: localhost:3100, 127.0.0.1:3100)
- `src/popup/Popup.tsx` — Main UI with tabs (Templates, Active, Receipts)
- `src/popup/Templates.tsx` — Template config + issue, agent identity panel
- `src/popup/ActiveCaps.tsx` — Lists active/revoked caps, revoke button, time remaining
- `src/popup/Receipts.tsx` — Audit timeline grouped by date, human-readable denial reasons
- `src/popup/api.ts` — API client with timeout, Zod schema validation on all responses
- `src/popup/agentIdentity.ts` — Ed25519 keypair generation/persistence
- `src/popup/popup.css` — Full styling with CSS variables, dark mode, accessibility
- Webpack build → dist/ ready to load as unpacked extension

### data/ (gitignored, runtime)
- `issuer_keys.json` — Ed25519 keypair generated on first proxy run
- `caps.json` — Capability storage
- `receipts.jsonl` — Append-only receipt log
- `revoked.json` — Revoked cap IDs (persists across restarts)
- `demo_agent_key.json` — SDK demo agent keypair

### TypeScript Configuration
- `tsconfig.base.json` — Security-grade settings:
  - `noUncheckedIndexedAccess: true`
  - `exactOptionalPropertyTypes: true`
  - `useUnknownInCatchVariables: true`
  - `noImplicitOverride: true`
  - `module: NodeNext`, `moduleResolution: NodeNext`

---

## Critical Blocker: RESOLVED

### Issue: Hard-coded zero pubkey in extension
- **Location**: `extension/src/popup/Templates.tsx`
- **Problem**: All capabilities bound to same agent identity (32 zero bytes)
- **Impact**: Couldn't test executor binding, multiple agents, or auth model

### Resolution (2026-02-10)
- Created `agentIdentity.ts` with Ed25519 keypair generation
- Keypair persisted to `chrome.storage.local`
- Agent identity panel shows ID + pubkey in UI
- "Generate New Keypair" button for executor mismatch testing
- Agent ID format validation: `agent:[a-z0-9._:-]{3,64}`
- Clipboard copy with error handling
- Created timestamp display

---

## Hardening Applied (2026-02-10)

### Extension (api.ts)
- Response schema validation with Zod on all endpoints
- `issueCapability()` → `CapDocSchema.parse()`
- `listCapabilities()` → `CapDocWithRevokedSchema` validation
- `listReceipts()` → `z.array(ReceiptSchema).parse()`
- `submitAction()` → `ActionResultSchema.parse()`

### Extension (agentIdentity.ts)
- `isIdentity()` runtime shape validation
- `created_at` timestamp on keypair
- `isValidAgentId()` format validation
- Storage key versioned (`v1`) for future migration

### Extension (Templates.tsx)
- Agent ID format validation with inline error
- Clipboard failure handling
- Identity loading state

### Shared (package.json)
- `exports` map for modern bundlers
- `files: ["dist"]` prevents publishing junk
- `sideEffects: false` enables tree-shaking
- Pinned versions: `tweetnacl: 1.0.3`, `zod: 3.22.4`
- `rimraf` for clean builds

### TypeScript
- All packages compile with security-grade tsconfig
- Fixed `noUncheckedIndexedAccess` errors in proxy and extension
- Fixed `exactOptionalPropertyTypes` errors in SDK

---

## What's Next

### Priority 1: OpenClaw Integration (Phase 1 target)
- Build CapNet skill for OpenClaw that routes agent actions through proxy
- 140K GitHub stars, documented security issues — perfect demo of CapNet value
- Three approaches: CapNet skill, proxy middleware, or MCP gateway

### Priority 2: Extension popup bug
- Popup displays as thin black bar on macOS Chrome
- CSS fix pushed (html+body dimensions) but needs Mac testing
- If still broken: right-click popup → Inspect → check console for errors

### Priority 3: Prompt 7 (remaining) — Attenuation/Delegation

### Already Done
- Executor binding (agent pubkey in cap, verified at enforcement)
- Executor mismatch denial (`EXECUTOR_MISMATCH`)

### Remaining
1. Delegation endpoint: `POST /capability/delegate`
2. Attenuation validation:
   - budget ≤ parent
   - expiry ≤ parent
   - vendors ⊆ parent
   - blocked ⊇ parent
3. `parent_cap_id` in derived caps
4. Receipts show delegation chain
5. SDK delegation method

---

## How to Run

```bash
cd /path/to/CapNET
nvm use        # Node 18
npm install
npm run build  # Build shared + extension
npm run dev    # Starts proxy (3100) + sandbox (3200)

# Extension:
# Load extension/dist/ as unpacked in chrome://extensions

# Demo:
npm run demo        # Run demo (services must be running)
npm run demo:clean  # Clear data and run demo
```

---

## Testing Protocol

### Tier 1: Deterministic Script (REQUIRED)

**Every tester must pass Tier 1 first.** Use `sdk/src/demo.ts` as the primary test agent.

Why deterministic first?
- LLM agents are nondeterministic → false negatives waste time
- Demo script is repeatable and debuggable
- Proves the rails work before adding unpredictability

Tier 1 validates:
- Capability issuance → action request → allow/deny → receipts
- Revocation and post-revoke denial
- Executor binding enforcement

### Tier 2: Real LLM Agent (OPTIONAL)

Only after Tier 1 passes 100%:

| Priority | Agent Type | Notes |
|----------|------------|-------|
| 1 | `sdk/src/demo.ts` | Required, deterministic |
| 2 | LLM CLI shim | Local script + OpenAI/Anthropic, agent proposes actions, proxy enforces |
| 3 | Browser agent | Extension-mediated, hardest, future work |

**Do NOT:**
- Use real LLM agents before Tier 1 passes
- Test with real merchants (Instacart/Stripe) yet
- Let testers freestyle prompts before proving the rails
- Give agents real credentials

**The principle:** LLM never touches credentials. It only proposes actions. CapNet policy decides what executes.

---

## Session Log

### 2026-02-04 — Recovery session
- Power outage interrupted previous session mid-Prompt 2
- Reviewed all code and documentation
- Confirmed Prompt 1 & 2 fully complete
- Proxy enforcement logic (Prompt 4 territory) already partially built
- Created this working notes file for continuity

### 2026-02-08 — Code review + paradigm alignment
- Developer code review of shared/ in progress
- Fixed shared/src/index.ts: explicit named exports only
- Major crypto.ts hardening (browser-safe base64, key validation, domain separation)
- Updated CAPNET_CONTEXT.md with paradigm-level vision

### 2026-02-09 — Prompt 3 complete: Wallet UI
- Built full extension UI with three tabs (Templates, Active, Receipts)
- API client expanded with proper types
- Code review feedback incorporated
- Prompts 1-6 now complete

### 2026-02-10 — Critical blocker fix + industrial hardening
- **Fixed critical blocker**: Hard-coded zero pubkey replaced with real Ed25519 keypair
- Agent identity management:
  - `agentIdentity.ts` with generate/persist/reset functions
  - Agent panel in UI with ID edit, pubkey copy
  - Format validation, created_at timestamp
- Response schema validation in extension API client
- Security-grade TypeScript configuration applied
- Fixed type errors from strict settings (proxy, extension, sdk)
- Hardened shared/package.json (exports, files, pinned deps)
- Full code review completed

### 2026-02-10 — Windows compatibility + tester handoff
- **Windows compatibility fixes**:
  - `tsx` scripts: Changed from `npx tsx` to `node ../node_modules/tsx/dist/cli.mjs`
  - `demo:clean` script: Replaced `rm -rf` with cross-platform Node.js code
  - Added troubleshooting for WSL/Windows node_modules mismatch
- **Documentation created**:
  - `TESTING_QUICKSTART.md` — 5-minute tester onboarding
  - `TEST_RUNBOOK.md` — Comprehensive 15-scenario test suite
  - Green/Red demo readiness checklist
  - Tiered testing approach (Tier 1: deterministic, Tier 2: LLM agent)
- **Demo verified on Windows**:
  - All 3 core scenarios pass (allow, deny, post-revoke deny)
  - `npm run demo:clean` works cross-platform
  - Services start correctly with `npm run dev`
- **Demo polish**:
  - Fixed receipt ordering: now sorted oldest→newest consistently
  - Added `CAPNET_DEMO_SEED` env var for deterministic runs
  - Updated docs with expected event order
- **Created TESTER_GUIDE.md**:
  - Complete external tester documentation
  - Explains what/why/how for third-party testers
  - Setup instructions, test scenarios (Tier 1/2/3)
  - What testers can modify and experiment with
  - Exploratory testing guidance
  - FAQ and troubleshooting
  - Issue reporting template
- **Project ready for tester handoff**

### 2026-02-20 — Architecture diagrams, messaging overhaul, extension fix, OpenClaw research
- **Architecture diagrams**: Generated 7-page color PDF (`CapNet_Architecture_Diagrams.pdf`) covering system architecture, issuance flow, enforcement decision tree, action flow, revocation flow, hijacker blast radius, and comparison matrix
- **Core messaging overhaul** — Two critical additions baked into all docs:
  - **Firewall distinction**: "CapNet is NOT a firewall. A fence for the agent, not a cage for the user." Added to CAPNET_CONTEXT.md, README.md, investor doc, and messaging guardrails
  - **Agent transport methods & adapter architecture**: How agents act today (API ~80%, MCP growing, browser ~15%, desktop ~5%, CLI niche). Transport-agnostic enforcement pipeline with adapter model. MCP as strategic inflection point (Phase 2)
- **Post-demo next steps**: Demo script now prints Chrome extension loading instructions and next steps after completion
- **Chrome extension instructions**: Expanded in TESTER_GUIDE.md and TESTING_QUICKSTART.md with full paths, platform examples, troubleshooting
- **Proxy startup message**: Added "CapNet services ready! Next steps:" to proxy listen output
- **Extension popup fix**: Fixed sizing on macOS — added explicit html+body dimensions, changed overflow from hidden to auto
- **OpenClaw research**: Identified as top Phase 1 integration target (140K GitHub stars, documented security issues from Cisco, perfect CapNet use case)
- **Investor doc regenerated** as `CapNet_Overview_v2.docx` with firewall distinction, transport methods, adapter architecture, MCP roadmap, and new FAQ entries
- **5 commits pushed to GitHub** (Connerlevi/CapNET)

### 2026-02-18 — Doc audit, bug fixes, investor doc, initial commit
- **Reinstalled node_modules from WSL** (fixed esbuild platform mismatch from Windows install)
- **Fixed `npm run build` failure**: Replaced broken `rimraf` dep with native `fs.rmSync` in shared/package.json
- **Fixed post-revoke denial reason**: Changed `proxy/src/store.ts` `findCapForAgent` to still return revoked caps (sorted after active). Enforcement pipeline now correctly returns `REVOKED` instead of `NO_CAPABILITY`
- **Full doc audit against live output**: Verified all 3 test docs + 3 project docs against actual `npm run demo:clean` output
  - Fixed demo output format (old `--- Step X ---` → actual `[X]` format)
  - Fixed catalog count: 17 → 16 items across all docs
  - Fixed audit trail: added ACTION_ATTEMPT events
  - Fixed "5 steps" → "9 steps" references
  - Fixed hardcoded WSL paths → generic `/path/to/CapNET`
  - Fixed reporting placeholder in TESTER_GUIDE
  - Updated TEST_RUNBOOK verified results with current output
- **Created investor overview**: Generated `CapNet_Investor_Overview.docx` (10-section hybrid doc with revenue model, GTM strategy, competitive landscape)
- **Verified end-to-end**: `npm run build` + `npm run dev` + `npm run demo:clean` all pass, all 3 key decisions correct
- **Initial git commit and push to GitHub**
