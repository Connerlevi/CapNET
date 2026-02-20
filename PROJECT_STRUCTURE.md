# CapNet Project Structure

> Updated: 2026-02-20 | Status: Phase 0 Complete

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
│       ├── index.ts             # CapNetClient class with all proxy methods
│       └── demo.ts              # Full lifecycle demo script (issue → allow → deny → revoke)
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
├── CAPNET_CONTEXT.md            # Vision, thesis, design principles
├── CAPNET_AI_ASSISTANT_PROMPTS.md # Build prompts (Prompt 1-9)
├── CAPNET_BETA_DEV_ROADMAP.md   # 6-week roadmap
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
| POST | `/capability/issue` | Issue a new capability |
| POST | `/action/request` | Request action (enforces cap constraints) |
| POST | `/capability/revoke` | Revoke a capability |
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

# Run full demo lifecycle (issue → allow → deny → revoke → deny)
npm run demo

# Clear data and run demo (fresh start)
npm run demo:clean

# Build shared + extension
npm run build
# Then load extension/dist/ as unpacked extension in Chrome

# Type-check all workspaces
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
        │                       │
        │                       ▼
        │               ┌─────────────────┐
        │               │     data/       │
        │               │  caps.json      │
        │               │  receipts.jsonl │
        │               │  revoked.json   │
        │               │  issuer_keys    │
        │               └─────────────────┘
        │
        ▼
┌─────────────────┐
│      SDK        │
│  (Agent lib)    │
└─────────────────┘
```

**Flow:**
1. Extension requests capability issuance from Proxy
2. Agent (via SDK) sends action requests to Proxy
3. Proxy enforces constraints, emits receipts
4. If allowed, Agent calls Sandbox checkout
5. User can revoke via Extension → Proxy
