# CapNet Phase 0 — AI Assistant Build Prompts

> **Mission:** Build the capability layer that lets agents take real actions safely.
>
> Use these prompts in order. Each prompt includes acceptance criteria. Stay strictly within Phase 0 scope: build the investor demo with maximum reliability and minimal dependencies.

---

## Current Status

| Prompt | Description | Status |
|--------|-------------|--------|
| 1 | Repo scaffold + stack | ✅ COMPLETE |
| 2 | CapDoc v0.1 + Action schemas | ✅ COMPLETE |
| 3 | Wallet UI (templates + active caps) | ✅ COMPLETE |
| 4 | Proxy enforcement boundary | ✅ COMPLETE |
| 5 | Merchant sandbox + checkout | ✅ COMPLETE |
| 6 | Revocation + post-revoke denial | ✅ COMPLETE |
| 7 | Executor binding + attenuation | PARTIAL (executor done, attenuation pending) |
| 8 | Demo polish + investor mode | PENDING |
| 9 | Conformance tests | PENDING |

---

## Prompt 1 — Repo scaffold + choose stack ✅ COMPLETE

You are the lead engineer implementing CapNet Phase 0 demo ("Agent Sandbox Wallet + Proxy"). Create a repo scaffold with `extension/`, `proxy/`, `sandbox/`, `sdk/`, `shared/`, `docs/`. Choose a fast stack: Chrome extension (TS/React), proxy (Node/Express), sandbox (Node/Express). Output: folder structure, package manifests, and a "how to run" README. Keep scope strictly Phase 0.

**Acceptance criteria**
- [x] `proxy` runs on localhost:3100 and returns `/health`
- [x] `sandbox` runs on localhost:3200 and returns `/health`
- [x] `extension` loads in Chrome and shows a page
- [x] Monorepo with npm workspaces

---

## Prompt 2 — Define CapDoc v0.1 + Action schema ✅ COMPLETE

Define `CapDoc v0.1` JSON schema and `ActionRequest/ActionResult/Receipt` schemas using Zod. Implement:
- Canonical JSON serialization (sorted keys, strict validation)
- Ed25519 signing with domain separation (`capnet:capdoc/0.1:`, etc.)
- Browser-safe base64 (works in Node and Chrome extension)
- Key length validation (32-byte pubkey, 64-byte signature)

Provide schemas in `shared/src/schemas/` and types that compile across all workspaces.

**Acceptance criteria**
- [x] Proxy validates signed capabilities
- [x] Types compile in extension + proxy + sandbox
- [x] Schemas reject invalid data (strict mode, cross-field validation)
- [x] Signing works in both Node and browser environments

---

## Prompt 3 — Build Wallet UI (templates + active caps) ✅ COMPLETE

Implement extension UI:
- Templates list (start with Groceries)
- Groceries template settings (budget, stores allow-list, block alcohol)
- Generate capability → POST to proxy `/capability/issue`
- Active capabilities list with revoke button
- Receipts timeline view

Use the existing `api.ts` module for all proxy calls.

**Acceptance criteria**
- [x] User creates a capability from template
- [x] Capability appears in "Active" list
- [x] Proxy stores capability and returns it
- [x] Revoke button calls `/capability/revoke`

---

## Prompt 4 — Implement proxy enforcement boundary ✅ COMPLETE

Implement `POST /action/request`:
- Validate ActionRequest schema
- Find matching active capability (deterministic: newest first)
- Verify signature before trusting cap fields
- Enforce constraints: vendor allow-list, category blocks, budget, time window
- Check revocation status
- Emit receipts for every action (ATTEMPT, ALLOWED, DENIED)
- Return ActionResult with matching receipt_id

**Acceptance criteria**
- [x] Allowed cart passes with receipt
- [x] Forbidden category blocks with reason `CATEGORY_BLOCKED:<category>`
- [x] Budget exceeded blocks with `AMOUNT_EXCEEDS_MAX`
- [x] Wrong vendor blocks with `VENDOR_NOT_ALLOWED`
- [x] Receipt written and retrievable via GET /receipts

---

## Prompt 5 — Build merchant sandbox + checkout wiring ✅ COMPLETE

Create sandbox merchant service:
- `GET /catalog` — returns items with SKU, name, category, price_cents
- Include blocked categories: alcohol, gift_cards, tobacco
- `POST /cart/validate` — validates cart, returns ActionRequest payload
- `POST /checkout` — creates order after proxy approval
- `GET /orders` — list/retrieve orders

Create example agent script in `sdk/` that:
- Fetches catalog
- Builds cart
- Calls proxy action request
- If allowed, calls sandbox checkout
- Prints results

**Acceptance criteria**
- [x] Catalog includes 16 items across multiple categories
- [x] Cart validation returns ready-to-use ActionRequest
- [x] Checkout creates order linked to receipt_id
- [x] Demo script runs end-to-end locally

---

## Prompt 6 — Revocation and post-revoke denial ✅ COMPLETE

Implement revocation:
- `POST /capability/revoke` with cap_id
- Persist revocations to disk (survives restart)
- Proxy checks revocation on every action request
- Emit CAP_REVOKED receipt event
- Extension revoke button calls proxy

**Acceptance criteria**
- [x] After revoke, agent cannot act
- [x] Deny reason is "REVOKED"
- [x] Revocation persists across proxy restart
- [x] Receipts show CAP_REVOKED event

---

## Prompt 7 — Executor binding + attenuation (delegation)

Add:
- Agent keypair identity (Ed25519 pubkey)
- Capability includes `executor.agent_pubkey`
- Proxy verifies caller identity matches capability binding
- Implement delegation:
  - Derive sub-capability with reduced budget + shorter expiry
  - Enforce monotone reduction (can only shrink authority)
  - Include `parent_cap_id` in derived caps
  - Receipts show delegation chain

**Acceptance criteria**
- [ ] Wrong agent pubkey fails with `EXECUTOR_MISMATCH`
- [ ] Derived capability is strictly smaller (budget, expiry)
- [ ] Cannot expand scope in derived capability
- [ ] Receipts show parent_cap_id for delegated actions

---

## Prompt 8 — Demo polish + investor mode

Add:
- "Investor Mode" with scripted carts (allowed, forbidden, revoke)
- Human-readable denial reasons in UI
- Receipts view with visual timeline
- One command to run all components (`npm run demo`)
- Clear console output showing enforcement decisions

**Acceptance criteria**
- [ ] Demo runs 10/10 times reliably
- [ ] Receipts and logs are legible to non-technical viewers
- [ ] All denial reasons are plain English
- [ ] Single command starts everything

---

## Prompt 9 — Minimal conformance tests

Add automated tests:
- Reject expanded scope in derived capability
- Reject revoked capability
- Reject wrong executor (pubkey mismatch)
- Reject blocked category
- Reject amount over budget
- Accept allowed purchase
- Verify receipts match ActionResults

**Acceptance criteria**
- [ ] Tests pass locally
- [ ] Tests can run in CI
- [ ] Failures have clear diagnostics

---

## Optional Prompt A — Investor demo script & captions

Create a 3-minute investor demo script with on-screen captions:
1. Template selection ("Groceries, $200/week, no alcohol")
2. Allowed action ("Agent buys milk and bread → Approved")
3. Denied action ("Agent tries to buy wine → Blocked: alcohol")
4. Revoke ("User revokes → Agent can no longer act")
5. Receipts ("Full audit trail of everything that happened")

---

## Optional Prompt B — One-page investor memo

Create a one-page investor memo answering:
- "Isn't this already solved by OAuth/IAM?"
- "Won't permissioning be tedious for users?"
- "Why now?"

Use analogies: "Seatbelts for agents" / "Leash, not master keys"

---

## Design Principles (apply to all prompts)

1. **Primitives over products** — Build atoms others can compose
2. **Developer-first packaging** — Drop-in, sane defaults
3. **Opinionated safety from day one** — Platforms get punished for insecure extensibility
4. **Assume breach** — Design for containment, not prevention alone
5. **Audit as a first-class citizen** — "Why did this happen?" must always be answerable
6. **Bottoms-up adoption** — A single engineer can adopt without committee approval
