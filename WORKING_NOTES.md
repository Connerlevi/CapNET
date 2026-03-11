# CapNet Phase 0 — Working Notes

> Session continuity document. Update after each work session.

---

## Last Updated: 2026-03-10

## Current Status: Phase 1 IN PROGRESS (SDK DX + OpenClaw + MCP Gateway COMPLETE, CI pipeline live)

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
| 8 | Demo polish + investor mode | DONE | 3 scenarios, VHS MP4 recordings, --record mode |
| 9 | Conformance tests | DONE | 15/15 tests passing (vitest) |

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
- `src/index.ts` — CapNetClient class + re-exports for high-level SDK
- `src/capnet.ts` — `CapNet.create()` entry point + `AgentBuilder` with `.spend()`, `.toolCalls()`
- `src/handle.ts` — `CapabilityHandle` wrapping CapDoc with `.purchase()`, `.execute()`, `.delegate()`, `.revoke()`
- `src/builders.ts` — Fluent `SpendCapabilityBuilder` and `ToolCallCapabilityBuilder` with `.block().issue()`
- `src/errors.ts` — Typed error hierarchy: `CapNetError` → `DeniedError` → `CategoryBlockedError`, `BudgetExceededError`, etc.
- `src/parsers.ts` — `parseBudget("100 USD")`, `parseDuration("30m")`, `durationToExpiry("1h")`
- `src/keys.ts` — `loadOrCreateKeypair()` for filesystem Ed25519 keypair persistence (`~/.capnet/keys/`)
- `src/types.ts` — Shared interfaces: `CapNetOptions`, `SpendOptions`, `ToolCallOptions`, `DelegateOptions`
- `src/protect.ts` — `protect(agent, { capabilities })` ES Proxy-based tool call interception
- `src/smoke-test.ts` — Manual smoke test for the builder API
- `src/demo.ts` — Core lifecycle demo: issue → delegate → allow → deny → cascade revoke → deny (10 steps)
- `src/demo-utils.ts` — Shared utilities: fetchJson, logging, health checks, types
- `src/scenarios/runaway-agent.ts` — Scenario 1: Cleanup bot with tool_call enforcement (9 steps)
- `src/scenarios/agent-hijack.ts` — Scenario 2: Prompt injection vs spend enforcement (9 steps)
- `src/scenarios/multi-agent-company.ts` — Scenario 3: Role isolation + delegation + cascade (14 steps)
- `src/scenarios/openclaw-hijack.ts` — Scenario 4: Malicious OpenClaw skill neutralized (11 steps)
- `src/scenarios/run-all.ts` — Runs all 4 scenarios sequentially

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

### Priority 1: Demo Polish (Prompt 8) — COMPLETE
- [x] Three demo scenarios implemented and type-checked
- [x] Shared demo utilities extracted (`demo-utils.ts`)
- [x] `npm run demo:runaway`, `demo:hijack`, `demo:company`, `demo:all` scripts
- [x] All 3 scenarios verified end-to-end
- [x] VHS MP4 recordings generated (5 tapes in `scripts/vhs-tapes/`, MP4s in `demos/`)
- [x] `--record` mode adds step-by-step pauses for readable playback
- [x] Conformance tests: 15/15 passing (`npm test`)

### Priority 2: SDK DX Overhaul — COMPLETE (2026-03-07)
- [x] Builder-pattern API: `CapNet.create()` → `.agent()` → `.spend().block().issue()` → `.purchase()`
- [x] Typed error hierarchy: `DeniedError`, `CategoryBlockedError`, `BudgetExceededError`, etc.
- [x] Budget/duration parsers: `parseBudget("100 USD")`, `parseDuration("30m")`
- [x] Auto-identity: `loadOrCreateKeypair()` with `~/.capnet/keys/` persistence
- [x] `CapabilityHandle` wraps CapDoc with `.purchase()`, `.execute()`, `.delegate()`, `.revoke()`
- [x] `protect()` wrapper for Proxy-based tool call interception
- [x] 46 new tests (36 unit + 10 integration), 61 total
- [x] All existing demos and 15 conformance tests still pass
- [x] Smoke test script verified end-to-end

### Priority 3: OpenClaw Integration (Phase 1 target) — COMPLETE (2026-03-09)
- [x] Auto-identity via `loadOrCreateKeypair()` (lazy init on first `enforce()` call)
- [x] Typed error classification via `classifyDenialError()` in `EnforcementResult.errorType`
- [x] `MockOpenClawRuntime` test harness simulating OpenClaw plugin API
- [x] 33 new tests (25 unit + 8 integration), 94 total
- [x] Demo Scenario 4: OpenClaw Hijack — Malicious Skill Neutralized (11 steps)
- [x] `npm run demo:openclaw` script, `demo:all` updated to run all 4 scenarios
- [x] `npm run typecheck` now includes `openclaw-plugin`

### Priority 4: MCP Security Gateway (Phase 1) — COMPLETE (2026-03-10)
- [x] `mcp-gateway/` workspace: `CapNetMcpGateway`, `GatewayEnforcer`, `UpstreamManager`
- [x] Wraps any MCP server transparently — agents connect via stdio, every tool call enforced
- [x] Auto-identity via `loadOrCreateKeypair()`, typed error classification
- [x] Tool category classification: 30+ MCP tool names → 7 categories
- [x] CLI entry point: `capnet-mcp-gateway --upstream "name:command:args"`
- [x] 19 new tests (9 types + 5 enforcer + 5 integration), 113 total
- [x] Tested against real `@modelcontextprotocol/server-filesystem`
- [x] CI pipeline: `.github/workflows/ci.yml` (typecheck, unit tests, integration tests)

### Priority 5: Governance Layer (Phase 2-3) — from Behavioral Intelligence Roadmap
- **Phase 2 (safe to build early, no ML, pure aggregation):**
  - Policy generation via NL Engine (`POST /capability/suggest`) — user becomes approver not author
  - Blast radius dashboard — sum of active capability envelopes, no ML needed
  - Basic receipt analytics — velocity, amount distribution, denial ratio
- **Phase 3 (requires real agent traffic from integrations):**
  - Behavioral baselines — per-agent/per-cap normal patterns (needs data)
  - Anomaly scoring — start with 4 dimensions: velocity, amount, new vendor, new capability
  - Adaptive response — auto-pause on anomaly score threshold (never overrides enforcement)
  - Trust calibration (late Phase 3) — Proof-of-Claim integration, verified vs unverified actions
- **Critical design constraint:** Intelligence layers advise/flag/pause — they NEVER override the deterministic enforcement engine. If the LLM is compromised, worst case is bad advice, never bad enforcement.
- **Renaming consideration:** "Behavioral Intelligence" → "Adaptive Governance" or "Governance Layer" (avoids sounding like an AI monitoring product)

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

### 2026-03-07 — Phase 0 COMPLETE: VHS recordings + conformance tests
- **VHS MP4 recordings generated**: Fixed Chrome/Chromium setup (removed broken snap, installed Chrome via apt). All 5 tape files now produce MP4 demos in `demos/`:
  - `capnet-quickstart.mp4` (753 KB)
  - `capnet-core-demo.mp4` (865 KB)
  - `capnet-runaway-agent.mp4` (806 KB)
  - `capnet-agent-hijack.mp4` (1.2 MB)
  - `capnet-multi-agent.mp4` (1.9 MB)
- **`--record` mode**: Added `pause()` helper to `demo-utils.ts` that inserts step-by-step delays when `--record` flag is passed. Demo scripts run at full speed normally, but pause between steps for readable video recordings.
- **Conformance tests (Prompt 9)**: 15/15 passing via vitest:
  - Spend enforcement: accept allowed, reject blocked category, reject over budget, reject wrong executor, reject after revocation
  - Tool call enforcement: accept allowed tool, reject unlisted tool, reject blocked category
  - Delegation: reject expanded budget, reject removed block, reject new vendor, accept valid attenuation, cascade revocation
  - Receipts: verify receipt_id matches for allowed and denied actions
- **All project docs updated**: README, PROJECT_STRUCTURE, CAPNET_CONTEXT, CAPNET_BETA_DEV_ROADMAP, CAPNET_AI_ASSISTANT_PROMPTS, WORKING_NOTES — all reflect Phase 0 complete status
- **Prompts 8 and 9 marked COMPLETE**. All 9 Phase 0 prompts done.

### 2026-03-06 — Demo scenarios verified, doc fixes, VHS setup, competitive analysis
- **Verified all demo scenarios end-to-end**: `demo:runaway`, `demo:hijack`, `demo:company`, `demo:all`, `demo:clean` — all pass
- **Fixed stale docs across 5 files**:
  - CAPNET_AI_ASSISTANT_PROMPTS.md: Prompt 7 → COMPLETE
  - PROJECT_STRUCTURE.md: Added delegation endpoints, scenario files, demo commands
  - CAPNET_BETA_DEV_ROADMAP.md: Added delegation/toolcall endpoints + denial reasons
  - WORKING_NOTES.md: Updated status, SDK section, priorities
  - Claude memory files updated
- **Competitive analysis**: Reviewed Zenity ($series A, Gartner Cool Vendor) and Noma Security ($132M raised). Conclusion: complementary not competitive. They do observability + detection (security camera). CapNet does authorization primitive (locked door). Different layers.
- **Reviewed CAPNET_BEHAVIORAL_INTELLIGENCE_ROADMAP.md** (2 review passes):
  - First review: Identified `Set<string>` serialization bug, missing Proof-of-Claim context, timeline conflicts, latency concern
  - Second review (after user updates): New sections 1.5 (NL Engine) and 1.6 (Agent-Agnostic Positioning) are solid. Architecture diagram fixed. OpenClaw tension addressed. Model ID updated. All previous issues resolved.
  - Confirmed: Behavioral intelligence is FUTURE roadmap, does NOT override Phase 0/1 priorities
- **VHS installed** at `/root/go/bin/vhs` (WSL, as root). `scripts/record-demo.sh` created (asciinema helper).
- **Next step**: Create VHS `.tape` files for demo recordings → render to GIF → embed in README

### 2026-03-05 — Demo scenarios + doc fixes
- **Three demo scenarios implemented**: Runaway Agent (tool_call), Agent Hijack (spend), Multi-Agent Company (role isolation + delegation + cascade)
- **Extracted demo-utils.ts**: Shared fetchJson, logging, health checks, types across all scenarios
- **run-all.ts**: Sequential runner for all 3 scenarios
- **Package scripts**: `demo:runaway`, `demo:hijack`, `demo:company`, `demo:all` added
- **Fixed stale docs**:
  - CAPNET_AI_ASSISTANT_PROMPTS.md: Prompt 7 status corrected to COMPLETE
  - PROJECT_STRUCTURE.md: Added delegation endpoints, scenario files, demo commands
  - CAPNET_BETA_DEV_ROADMAP.md: Added delegation/toolcall endpoints and denial reasons
  - WORKING_NOTES.md: Updated status, SDK section, priorities
- **All SDK type-checks pass**: `npx tsc --noEmit -p sdk/tsconfig.json`

### 2026-03-07 — SDK DX Overhaul (Phase 1)
- **Built high-level builder-pattern SDK** wrapping existing `CapNetClient` (no breaking changes):
  - `CapNet.create()` → verifies proxy health, returns facade
  - `.agent(id)` → `AgentBuilder` with lazy keypair resolution
  - `.spend({ budget: "50 USD", vendors: [...] }).block("alcohol").issue()` → `CapabilityHandle`
  - `.toolCalls({ tools: [...], maxCalls: 10 }).block("shell").issue()` → `CapabilityHandle`
  - `CapabilityHandle.purchase()` encapsulates sandbox cart-validate → proxy action two-step
  - `CapabilityHandle.execute()` builds tool_call requests with auto request ID
  - `CapabilityHandle.delegate()` and `.revoke()` for delegation/revocation
  - `protect(agent, { capabilities })` for ES Proxy-based tool interception
- **Typed error hierarchy**: `CapNetError` → `DeniedError` → `CategoryBlockedError`, `BudgetExceededError`, `RevokedCapabilityError`, `ToolNotAllowedError`, `ExecutorMismatchError`, `ExpiredCapabilityError`
- **Pure utility functions**: `parseBudget("100 USD")` → `{ cents: 10000, currency: "USD" }`, `parseDuration("30m")` → ms, `durationToExpiry("1h")` → ISO string
- **Filesystem keypair persistence**: `loadOrCreateKeypair(agentId)` in `~/.capnet/keys/`
- **New files**: `sdk/src/{types,parsers,errors,keys,handle,builders,capnet,protect}.ts` + `smoke-test.ts`
- **46 new tests** (36 unit + 10 integration): parsers, errors, keys, full builder lifecycle
- **All verification passed**: `npm run typecheck` clean, 15/15 conformance, 61/61 total tests, `npm run demo:all` all 3 scenarios, smoke test end-to-end
- **Existing code untouched**: only appended re-exports to `sdk/src/index.ts`

### 2026-03-09 — OpenClaw Integration COMPLETE (Phase 1)
- **Plugin enhancements**:
  - `enforcer.ts`: Auto-identity via `loadOrCreateKeypair()` — lazy init on first `enforce()`, no manual keypair config needed
  - `enforcer.ts`: Typed error classification via `classifyDenialError()` → `EnforcementResult.errorType` field
  - `types.ts`: Added `keysDir` config option for custom keypair directory
  - `index.ts`: Deny messages now include `[ErrorType]` suffix (e.g. `[CategoryBlockedError]`)
- **Test harness**: `tests/openclaw/harness.ts` — `MockOpenClawRuntime` simulates OpenClaw plugin API (hooks, routes, logger, trigger methods)
- **33 new tests** (25 unit + 8 integration):
  - `enforcer.test.ts` (15): shouldGate logic, category mapping, fail policy
  - `plugin.test.ts` (10): hook registration, status endpoint, config logging, before_tool_call behavior
  - `integration.test.ts` (8): full lifecycle with proxy — allow/deny/revoke/receipts/typed errors
- **Demo Scenario 4**: OpenClaw Hijack — Malicious Skill Neutralized
  - Story: Malicious "productivity" skill from ClawHub attempts exfiltration, destruction, messaging, and sub-agent spawn
  - 6 tool calls: 4 denied (shell, messaging, spawn), 2 allowed (web_search, fs_read)
  - `npm run demo:openclaw` script added
- **Updated scripts**:
  - `demo:all` now runs all 4 scenarios (was 3)
  - `typecheck` now includes `openclaw-plugin/tsconfig.json`
  - SDK `run-all.ts` updated to include Scenario 4
- **Verification**: 94/94 tests passing, all 4 demos work, typecheck clean across all packages

### 2026-03-10 — MCP Security Gateway + CI Pipeline
- **MCP Gateway workspace** (`mcp-gateway/`): Full MCP-to-CapNet policy enforcement gateway
  - `types.ts`: `GatewayConfig`, `UpstreamServer`, `GatewayTool` interfaces + `classifyTool()` with 30+ tool→category mappings
  - `upstream.ts`: `UpstreamManager` — connects to MCP servers via `StdioClientTransport`, discovers tools, forwards calls
  - `enforcer.ts`: `GatewayEnforcer` — validates tool calls against CapNet proxy, auto-identity, fail policy, typed errors
  - `gateway.ts`: `CapNetMcpGateway` — the core MCP server, wraps upstream tools with enforcement on every call
  - `index.ts`: CLI entry point with `--upstream "name:command:arg1,arg2"` parsing, stdio transport
- **19 new tests** (9 types unit + 5 enforcer unit + 5 integration):
  - `tests/mcp-gateway/types.test.ts`: Tool classification across all 7 categories
  - `tests/mcp-gateway/enforcer.test.ts`: Fail policy (closed/open), latency reporting, proxy check
  - `tests/mcp-gateway/gateway.test.ts`: Full lifecycle with real `@modelcontextprotocol/server-filesystem`
- **CI pipeline** (`.github/workflows/ci.yml`):
  - 3 jobs: `typecheck`, `unit-tests`, `integration-tests`
  - Integration tests start proxy+sandbox, wait for health, run full suite
  - Triggers on push/PR to main/master
- **TypeScript strictness fixes**: `exactOptionalPropertyTypes` required changes in upstream.ts (env, description, isError) and index.ts (config assignments)
- **Updated root package.json**: Added `mcp-gateway` workspace, `typecheck` includes mcp-gateway
- **Verification**: 113/113 tests passing, typecheck clean across all 6 packages

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
