# CapNet Project Structure

> Updated: 2026-03-10 | Status: Phase 1 IN PROGRESS (SDK DX + OpenClaw + MCP Gateway complete, CI pipeline live)

```
CapNET/
├── package.json                 # Root monorepo config (npm workspaces)
├── package-lock.json
├── tsconfig.base.json           # Shared TypeScript config
│
├── docs/
│   └── spec_v0.1.md             # CapNet specification (draft)
│
├── data/                        # Runtime data (gitignored, created on first run)
│   ├── caps.json                # Stored capabilities
│   ├── receipts.jsonl           # Append-only receipt log
│   ├── revoked.json             # Revoked capability IDs
│   └── issuer_keys.json         # Proxy issuer Ed25519 keypair
│
├── shared/                      # @capnet/shared — Schemas, types, crypto
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Public API exports
│       ├── crypto.ts            # Ed25519 signing, verification, canonicalization
│       └── schemas/
│           ├── index.ts         # Schema barrel (internal)
│           ├── capdoc.ts        # CapDoc v0.1 Zod schema
│           ├── action.ts        # ActionRequest, ActionResult, CartItem schemas
│           └── receipt.ts       # Receipt schema with event types
│
├── proxy/                       # @capnet/proxy — Enforcement boundary (port 3100)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Express server, all API endpoints
│       └── store.ts             # File-based persistence (caps, receipts, keys, revocations)
│
├── sandbox/                     # @capnet/sandbox — Merchant simulator (port 3200)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts             # Express server, catalog, cart, checkout, orders
│
├── sdk/                         # @capnet/sdk — Client library for agents
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # CapNetClient class + high-level SDK re-exports
│       ├── capnet.ts            # CapNet.create() entry point + AgentBuilder
│       ├── handle.ts            # CapabilityHandle (purchase, execute, delegate, revoke)
│       ├── builders.ts          # SpendCapabilityBuilder, ToolCallCapabilityBuilder
│       ├── errors.ts            # Typed error hierarchy (DeniedError, CategoryBlockedError, etc.)
│       ├── parsers.ts           # parseBudget(), parseDuration(), durationToExpiry()
│       ├── keys.ts              # loadOrCreateKeypair() — filesystem keypair persistence
│       ├── types.ts             # Shared interfaces (CapNetOptions, SpendOptions, etc.)
│       ├── protect.ts           # protect() — ES Proxy tool call interception
│       ├── smoke-test.ts        # Manual smoke test for builder API
│       ├── demo.ts              # Core lifecycle demo (issue → delegate → allow → deny → revoke)
│       ├── demo-utils.ts        # Shared utilities for demo scripts
│       └── scenarios/
│           ├── runaway-agent.ts      # Scenario 1: Cleanup bot with tool_call enforcement
│           ├── agent-hijack.ts       # Scenario 2: Prompt injection with spend enforcement
│           ├── multi-agent-company.ts # Scenario 3: Role isolation + delegation + cascade
│           ├── openclaw-hijack.ts    # Scenario 4: Malicious OpenClaw skill neutralized
│           └── run-all.ts            # Runs all 4 scenarios sequentially
│
├── openclaw-plugin/             # @capnet/openclaw-plugin — OpenClaw enforcement plugin
│   ├── package.json
│   ├── tsconfig.json
│   ├── openclaw.plugin.json     # Plugin manifest with config schema
│   └── src/
│       ├── types.ts             # Config interface, OpenClaw API surface, tool category map
│       ├── enforcer.ts          # CapNetEnforcer — proxy communication, auto-identity, fail policy
│       └── index.ts             # Plugin registration: hooks, HTTP route, deny formatting
│
├── mcp-gateway/                 # @capnet/mcp-gateway — MCP policy enforcement gateway
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts             # GatewayConfig, UpstreamServer, GatewayTool, classifyTool()
│       ├── upstream.ts          # UpstreamManager — connects to MCP servers, discovers/forwards tools
│       ├── enforcer.ts          # GatewayEnforcer — validates tool calls against CapNet proxy
│       ├── gateway.ts           # CapNetMcpGateway — MCP server wrapping upstreams with enforcement
│       └── index.ts             # CLI entry point + public API exports
│
├── extension/                   # @capnet/extension — Chrome MV3 wallet UI
│   ├── package.json
│   ├── tsconfig.json
│   ├── webpack.config.js
│   ├── public/
│   │   ├── manifest.json        # Chrome extension manifest
│   │   └── icons/
│   │       ├── icon16.png
│   │       ├── icon48.png
│   │       └── icon128.png
│   ├── src/
│   │   └── popup/
│   │       ├── index.tsx        # React entry point
│   │       ├── Popup.tsx        # Main popup component (tabs)
│   │       ├── Templates.tsx    # Template config + issue capability
│   │       ├── ActiveCaps.tsx   # List active/revoked caps, revoke button
│   │       ├── Receipts.tsx     # Audit timeline grouped by date
│   │       ├── api.ts           # Proxy API client with Zod validation
│   │       ├── agentIdentity.ts # Ed25519 keypair generation/persistence
│   │       ├── popup.html       # HTML template
│   │       └── popup.css        # Styles with dark mode, CSS variables
│   └── dist/                    # Build output (gitignored)
│
├── tests/                       # Tests (vitest)
│   ├── conformance.test.ts      # 15 integration tests against live proxy/sandbox
│   ├── sdk/
│   │   ├── parsers.test.ts      # 18 unit tests: budget/duration parsing
│   │   ├── errors.test.ts       # 14 unit tests: error classification, instanceof chains
│   │   ├── keys.test.ts         # 4 unit tests: keypair persistence/loading
│   │   └── builder.test.ts      # 10 integration tests: full builder lifecycle
│   ├── openclaw/
│   │   ├── harness.ts           # MockOpenClawRuntime — simulates plugin API for testing
│   │   ├── enforcer.test.ts     # 15 unit tests: gating logic, category mapping, fail policy
│   │   ├── plugin.test.ts       # 10 unit tests: hook registration, status endpoint, config
│   │   └── integration.test.ts  # 8 integration tests: full lifecycle with proxy
│   └── mcp-gateway/
│       ├── types.test.ts        # 9 unit tests: tool classification across all categories
│       ├── enforcer.test.ts     # 5 unit tests: fail policy, latency, proxy check
│       └── gateway.test.ts      # 5 integration tests: full lifecycle with real MCP server
│
├── .github/
│   └── workflows/
│       └── ci.yml               # CI pipeline: typecheck, unit tests, integration tests
│
├── demos/                       # Demo recordings and text output
│   ├── capnet-quickstart.mp4    # 60-second overview
│   ├── capnet-core-demo.mp4     # Core lifecycle demo
│   ├── capnet-runaway-agent.mp4 # Scenario 1: Runaway Agent
│   ├── capnet-agent-hijack.mp4  # Scenario 2: Agent Hijack
│   ├── capnet-multi-agent.mp4   # Scenario 3: Multi-Agent Company
│   ├── *.txt                    # Text output captures
│   └── README.md                # Demo index
│
├── scripts/                     # Recording and utility scripts
│   ├── vhs-tapes/               # VHS tape files for MP4 generation
│   │   ├── quickstart.tape
│   │   ├── demo-core.tape
│   │   ├── demo-runaway.tape
│   │   ├── demo-hijack.tape
│   │   └── demo-company.tape
│   ├── record-demo.sh           # Asciinema recording helper
│   └── record-demos.sh          # Batch recording script
│
├── vitest.config.ts             # Test configuration
├── CAPNET_CONTEXT.md            # Vision, thesis, design principles
├── CAPNET_AI_ASSISTANT_PROMPTS.md # Build prompts (Prompt 1-9, all complete)
├── CAPNET_BETA_DEV_ROADMAP.md   # 6-week roadmap (complete)
├── CAPNET_BEHAVIORAL_INTELLIGENCE_ROADMAP.md # Future roadmap (not Phase 0/1)
├── capnet_development_alignment.md # Development alignment + demo strategy
├── WORKING_NOTES.md             # Session continuity, status tracking
├── PROJECT_STRUCTURE.md         # This file
├── README.md                    # Quick start guide
├── TESTER_GUIDE.md              # Complete external tester guide
├── TESTING_QUICKSTART.md        # 5-minute tester onboarding
├── TEST_RUNBOOK.md              # Comprehensive 15-scenario test suite
├── CapNet_Overview_v2.docx          # Investor & collaborator overview document
├── CapNet_Architecture_Diagrams.pdf # 7-page color architecture diagrams
├── generate_investor_doc.py         # Script to regenerate investor .docx
└── generate_architecture_diagrams.py # Script to regenerate architecture diagrams PDF
```

---

## Workspaces

| Workspace | Package | Port | Purpose |
|-----------|---------|------|---------|
| `shared/` | `@capnet/shared` | — | Zod schemas, TypeScript types, Ed25519 crypto |
| `proxy/` | `@capnet/proxy` | 3100 | Enforcement boundary, capability issuance, receipts |
| `sandbox/` | `@capnet/sandbox` | 3200 | Merchant simulator with catalog and checkout |
| `sdk/` | `@capnet/sdk` | — | Client library for agents to interact with proxy |
| `openclaw-plugin/` | `@capnet/openclaw-plugin` | — | OpenClaw enforcement plugin (auto-identity, typed errors) |
| `mcp-gateway/` | `@capnet/mcp-gateway` | — | MCP policy enforcement gateway (wraps MCP servers with CapNet) |
| `extension/` | `@capnet/extension` | — | Chrome MV3 wallet UI |

---

## Key Files

### Schemas (`shared/src/schemas/`)

| File | Exports | Purpose |
|------|---------|---------|
| `capdoc.ts` | `CapDocSchema`, `CapDoc` | Capability document with constraints, proof, revocation |
| `action.ts` | `ActionRequestSchema`, `ActionResultSchema`, `CartItemSchema` | Request/response for spend actions |
| `receipt.ts` | `ReceiptSchema`, `ReceiptEventSchema` | Audit trail events |

### Proxy Endpoints (`proxy/src/index.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/capability/issue` | Issue a spend capability |
| POST | `/capability/issue/toolcall` | Issue a tool_call capability |
| POST | `/capability/delegate` | Delegate sub-capability with attenuation |
| POST | `/action/request` | Request spend action (enforces cap constraints) |
| POST | `/action/toolcall` | Request tool call action (enforces tool constraints) |
| POST | `/capability/revoke` | Revoke a capability (cascade to children) |
| GET | `/capabilities` | List all capabilities |
| GET | `/receipts` | Query receipt log |

### Sandbox Endpoints (`sandbox/src/index.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/catalog` | Get product catalog |
| POST | `/cart/validate` | Validate cart, return ActionRequest payload |
| POST | `/checkout` | Create order (after proxy approval) |
| GET | `/orders` | List all orders |
| GET | `/orders/:id` | Get order by ID |

---

## Data Files (`data/`)

| File | Format | Purpose |
|------|--------|---------|
| `caps.json` | JSON object | Stored capabilities keyed by cap_id |
| `receipts.jsonl` | JSONL (one per line) | Append-only audit log |
| `revoked.json` | JSON array | List of revoked cap_ids |
| `issuer_keys.json` | JSON object | Proxy's Ed25519 keypair (publicKeyB64, secretKeyB64) |
| `demo_agent_key.json` | JSON object | SDK demo agent Ed25519 keypair |

---

## Commands

```bash
# Install dependencies
npm install

# Run proxy + sandbox in dev mode
npm run dev

# Run core lifecycle demo (issue → delegate → allow → deny → revoke)
npm run demo

# Run demo scenarios
npm run demo:runaway    # Scenario 1: Runaway Agent (tool_call enforcement)
npm run demo:hijack     # Scenario 2: Agent Hijack (spend enforcement)
npm run demo:company    # Scenario 3: Multi-Agent Company (role isolation)
npm run demo:openclaw   # Scenario 4: OpenClaw Hijack (malicious skill neutralized)
npm run demo:all        # Run all 4 scenarios

# Clear data and run demo (fresh start)
npm run demo:clean

# Build shared + extension
npm run build
# Then load extension/dist/ as unpacked extension in Chrome

# Run all tests — 113 tests (proxy + sandbox must be running for integration tests)
npm test

# Run SDK smoke test (proxy + sandbox must be running)
npx tsx sdk/src/smoke-test.ts

# Type-check all workspaces (proxy, sandbox, sdk, openclaw-plugin, mcp-gateway)
npm run typecheck

# Type-check all + build extension
npm run typecheck:all
```

**Cross-platform:** All scripts work on Windows, macOS, and Linux.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Extension     │     │     Proxy       │     │    Sandbox      │
│   (Chrome MV3)  │────▶│  (port 3100)    │────▶│  (port 3200)    │
│                 │     │  Enforcement    │     │  Merchant Sim   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                    ▲    │
        │                    │    ▼
        │                    │  ┌─────────────────┐
        │                    │  │     data/       │
        │                    │  │  caps.json      │
        │                    │  │  receipts.jsonl │
        │                    │  │  revoked.json   │
        │                    │  └─────────────────┘
        │                    │
        ▼                    │
┌─────────────────┐          │
│      SDK        │──────────┘
│  (Agent lib)    │
└─────────────────┘
                             │
┌─────────────────────────────────────────────┐
│  MCP Gateway                                │
│  Agent ──(stdio)──▶ Gateway ──▶ Proxy       │
│                       │                     │
│                       ▼                     │
│              Upstream MCP Servers            │
│          (filesystem, brave, etc.)          │
└─────────────────────────────────────────────┘
```

**Flow:**
1. Extension requests capability issuance from Proxy
2. Agent (via SDK) sends action requests to Proxy
3. Proxy enforces constraints, emits receipts
4. If allowed, Agent calls Sandbox checkout
5. User can revoke via Extension → Proxy

**MCP Gateway Flow:**
1. Agent connects to MCP Gateway via stdio (thinks it's a normal MCP server)
2. Gateway discovers tools from upstream MCP servers
3. On every tool call, Gateway enforces via CapNet Proxy
4. If allowed, forwards call to upstream; if denied, returns error
5. Agent never knows CapNet is there
