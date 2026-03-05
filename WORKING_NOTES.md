# CapNet Phase 0 — Working Notes

> Session continuity document. Update after each work session.

---

## Last Updated: 2026-03-05

## Current Status: Delegation/Attenuation COMPLETE — Prompt 7 fully done, demo verified with cascade revocation

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
| 7 | Executor binding + attenuation | DONE | Executor binding + full delegation/attenuation with cascade revocation |
| 8 | Demo polish + investor mode | NOT STARTED | |
| 9 | Conformance tests | NOT STARTED | |

---

## What Exists (verified 2026-02-10)

### shared/ (@capnet/shared)
- `src/schemas/capdoc.ts` — CapDoc v0.1 Zod schema (strict, cross-field validation, delegation fields)
- `src/schemas/action.ts` — ActionRequest, ActionResult, CartItem, DenyReason schemas (includes delegation denial reasons)
- `src/schemas/receipt.ts` — Receipt schema with JSON-safe meta, event validation (includes CAP_DELEGATED)
- `src/crypto.ts` — Ed25519 with domain separation, browser-safe base64, key length validation
- `src/index.ts` — Explicit barrel exports (no export *)
- `package.json` — Hardened: exports map, files, sideEffects:false, pinned deps, rimraf clean
- `dist/` — Compiled and ready for consumption

### proxy/ (@capnet/proxy) — port 3100
- `src/index.ts` — Express server with:
  - `GET /health` — working
  - `POST /capability/issue` — signs and stores CapDocs, emits CAP_ISSUED receipt
  - `POST /capability/delegate` — delegates sub-capability with attenuation validation, chain checks
  - `POST /action/request` — full enforcement: vendor, category, budget, time, executor, signature, parent chain
  - `POST /action/toolcall` — tool call enforcement with parent chain validation
  - `POST /capability/revoke` — cascade revocation (parent + all descendants), emits CAP_REVOKED per cap
  - `GET /capabilities` — lists all caps with is_revoked status
  - `GET /receipts` — query with limit/since params
- `src/store.ts` — File-based persistence with atomic writes, revocation persistence, delegation chain functions
  - `findChildCaps(parentCapId)` — find all direct children of a cap
  - `revokeCapCascade(capId)` — BFS cascade revocation with cycle protection
  - `getDelegationChain(capId)` — walk parent chain to root
- CORS configured for chrome-extension:// and localhost/127.0.0.1 origins
- Verification order: signature → executor → time → revocation → parent chain → constraints

### sandbox/ (@capnet/sandbox) — port 3200
- `src/index.ts` — Express server with:
  - `GET /health` — working
  - `GET /catalog` — 16 items across grocery, alcohol, gift_cards, tobacco, household
  - `POST /cart/validate` — validates cart, returns ActionRequest payload
  - `POST /checkout` — creates order after proxy approval
  - `GET /orders` and `GET /orders/:id` — list/retrieve orders

### sdk/ (@capnet/sdk)
- `src/index.ts` — CapNetClient class with all proxy methods, AbortController timeouts, delegateCapability()
- `src/demo.ts` — Full lifecycle demo: issue → delegate → allow → deny → cascade revoke → deny
  - Generates/loads real Ed25519 agent keypair (data/demo_agent_key.json)
  - Generates sub-agent keypair for delegation demo
  - Delegates with reduced budget ($20 from $50) and additional blocked category
  - Demonstrates cascade revocation (parent revoke → child denied)
  - Imports types from @capnet/shared (no drift)
  - Clear audit trail output (10 steps)

### extension/ (@capnet/extension)
- Chrome MV3 manifest (permissions: storage, host: localhost:3100, 127.0.0.1:3100)
- `src/popup/Popup.tsx` — Main UI with tabs (Templates, Active, Receipts)
- `src/popup/Templates.tsx` — Template config + issue, agent identity panel
- `src/popup/ActiveCaps.tsx` — Lists active/revoked caps, revoke button, time remaining, parent/depth display
- `src/popup/Receipts.tsx` — Audit timeline grouped by date, human-readable denial reasons, delegation metadata
- `src/popup/api.ts` — API client with timeout, Zod schema validation, delegateCapability()
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

### Priority 1: Demo Polish (Prompt 8) + Three Demo Scenarios
- Polish existing demo for investor-readiness
- Build three demo scenarios from capnet_development_alignment.md:
  1. **Runaway Agent** — Agent with credentials does destructive actions; CapNet blocks them
  2. **Agent Hijack** — Prompt injection triggers gift card purchase; CapNet denies blocked category
  3. **Multi-Agent Company** — Multiple agents with scoped capabilities (sales, finance, engineering)

### Priority 2: SDK DX Overhaul
- Simplify developer onboarding to `import { CapNet } from "capnet"` level
- Intuitive capability definitions
- Minimal integration friction

### Priority 3: OpenClaw Integration (Phase 1 target)
- Build CapNet skill for OpenClaw that routes agent actions through proxy
- 140K GitHub stars, documented security issues — perfect demo of CapNet value
- Three approaches: CapNet skill, proxy middleware, or MCP gateway

### Priority 4: MCP Security Gateway
- CapNet as policy enforcement gateway for MCP tools
- Wraps MCP servers transparently — agents don't even know CapNet is there

### Completed (Prompt 7)
- Executor binding (agent pubkey in cap, verified at enforcement)
- Executor mismatch denial (`EXECUTOR_MISMATCH`)
- Delegation endpoint: `POST /capability/delegate`
- Full attenuation validation (budget ≤ parent, expiry ≤ parent, vendors ⊆ parent, blocked ⊇ parent)
- Tool call delegation support (tools ⊆ parent, blocked ⊇ parent, max_calls ≤ parent)
- `parent_cap_id` and `delegation_depth` in derived caps
- Parent chain validation on every action request
- Cascade revocation (revoking parent revokes all descendants)
- `CAP_DELEGATED` receipt event
- `PARENT_REVOKED`, `PARENT_EXPIRED`, `DELEGATION_DEPTH_EXCEEDED`, `ATTENUATION_VIOLATION` denial reasons
- SDK `delegateCapability()` method
- Extension UI shows delegation chain (parent, depth, cascade metadata)
- Demo script updated with delegation step (10 steps total)

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

### 2026-03-05 — Delegation/Attenuation (Prompt 7 complete)
- **Reviewed two new docs**: `capnet-vision-explainer-v2.html` (investor-facing three-layer architecture) and `capnet_development_alignment.md` (3 demo scenarios + 5-phase dev priority)
- **Consolidated development roadmap** integrating both new docs with existing priorities
- **Implemented full delegation/attenuation system** (14 implementation steps):
  - Schema changes: `parent_cap_id`, `delegation_depth` in CapDoc; `CAP_DELEGATED` receipt event; 4 new denial reasons
  - Store functions: `findChildCaps`, `revokeCapCascade` (BFS with cycle protection), `getDelegationChain`
  - `POST /capability/delegate` endpoint with full attenuation validation for both spend and tool_call
  - Parent chain validation in both enforcement pipelines (`/action/request` and `/action/toolcall`)
  - Cascade revocation: revoking parent revokes all descendants, emits receipt per cap
  - SDK: `DelegateCapabilityRequest` interface + `delegateCapability()` method
  - Extension: `delegateCapability()` API function, parent/depth display in ActiveCaps, CAP_DELEGATED + cascade metadata in Receipts
  - Demo script: Added delegation step (sub-agent with $20 budget from $50 parent, extra blocked category), cascade revocation demo, updated from 9 to 10 steps
- **All builds pass**: `npm run build`, proxy type-check, SDK type-check
- **Demo verified**: `npm run demo:clean` passes all 10 steps — delegation, attenuation enforcement, cascade revocation all working

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
