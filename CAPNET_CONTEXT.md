# CapNet — Context & Alignment

## What this document is
This is the shared context file for CapNet. It defines the paradigm-level vision, the Phase 0 wedge, and the principles that guide all implementation decisions. Everything we build should ladder up to the fundamental thesis.

---

## 0) The Thesis (paradigm-level)

**CapNet is the capability layer that lets agents take real actions safely, by enforcing scoped authority + policy gates + audit proofs across any tool.**

We are not building a product. We are building a **new fundamental layer** for the agentic era — the trust and permission fabric that makes machine actors governable.

### Why this matters now
- Agents are becoming a new class of actor on the internet
- They turn natural language into real-world side effects (money, permissions, data, deployments)
- They operate at machine speed and machine scale
- The "intent → action" distance is collapsing — and that's where safety used to live
- **The new choke point is authority**: who/what is allowed to do what, with what scope, under what auditability

### The missing layer
The internet solved transport and addressing. AI is solving cognition and action. **Nobody has solved governable authority for machine actors.** That's CapNet.

When agents become the UI, software turns into APIs + control planes. The most valuable layer becomes:
- Orchestration
- Permissions
- Audit/compliance
- Cross-system interoperability

CapNet sits in that seam.

---

## 1) CapNet in one paragraph (non‑technical)

CapNet is a new permission layer for the Agent Era. Today, to let software or AI agents take actions (spend money, access accounts, operate tools), we share credentials (passwords, session cookies, API keys) — which are effectively master keys. CapNet replaces master keys with bounded, revocable permissions ("capabilities") enforced at the boundary where actions occur. Users don't micromanage every action; they set simple templates (budget/time/vendor rules), and the system compiles them into enforceable permissions. Even a compromised agent cannot exceed the leash.

**Key phrase:** *"Leash, not master keys."*

### What CapNet is NOT

This distinction is critical and must be made early in every conversation:

- **Not a firewall.** A firewall monitors all traffic — yours, your agent's, everyone's. CapNet only governs the agent. The human can still do whatever they want. Buy alcohol, overspend, use any vendor. CapNet doesn't touch that.
- **Not surveillance.** CapNet doesn't watch your browsing, scan your data, or filter your content. It's not DLP. It's not parental controls for adults.
- **Not an access control list for humans.** CapNet doesn't restrict the user. The user *sets* the policy. The user *controls* revocation. The user retains full authority — they're choosing how much to *delegate* to the agent.
- **Not a prompt-based restriction.** CapNet doesn't ask the AI "please don't buy alcohol." The agent can *try* anything it wants. The enforcement proxy is a separate service that blocks forbidden actions regardless of what the agent intends. A prompt is a suggestion. A capability is a physical boundary.

**The analogy isn't a firewall. It's power of attorney with limits** — you authorize someone to act on your behalf, but only within specific bounds, and you can revoke it instantly.

**Key phrase:** *"A fence for the agent, not a cage for the user."*

---

## 2) What makes CapNet "fundamental" (not just a product)

To be paradigm-grade infrastructure (like TCP/IP), CapNet must be:

### A primitive (the unit of authority)
CapNet defines the standard "atom" of power for agents:
- **Scoped** — narrowly targeted to specific resources and actions
- **Time-bounded** — expires, can have not-before constraints
- **Revocable** — can be killed instantly
- **Composable** — capabilities can delegate attenuated sub-capabilities
- **Traceable** — full chain of who requested, who approved, what policy allowed it

**If we win the unit of authority, we become fundamental.**

### A control plane (policy + enforcement)
Agents don't need more identity; they need guardrails that actually bite:
- **Policy-as-code gates** — deterministic allow/deny + step-up approval
- **Runtime enforcement** — not just logging after the fact
- **Blast-radius containment** — default-deny, least privilege, sandboxing
- **Kill switch semantics** — rapid revocation and quarantine

**If CapNet sits between agents and the world and is trusted, we're infrastructure.**

### A distribution surface (ecosystem)
Disruption requires distribution:
- Dead-simple developer onboarding (SDK + proxy + quickstart)
- Connectors to the systems agents touch (cloud, identity, ticketing, finance, code, data)
- Policy packs people can share and standardize on
- A spec people can build against

**If third parties build "for CapNet," we're no longer a tool — we're a layer.**

---

## 3) The litmus test (are we aiming high enough?)

CapNet will have paradigm-level impact if we can answer "yes" to most of these:

| Question | Target |
|----------|--------|
| Is there a 5-minute "holy crap" demo? | Something a skeptic feels instantly |
| Does it spread bottoms-up? | A single engineer can adopt without committee approval |
| Is it extensible? | An ecosystem forms: policies/modules/integrations others publish |
| Does it become a default primitive? | "Of course we use CapNet for agent authorization" |
| Is there a clear wedge + ladder? | Wedge = narrow must-have; ladder = broader platform |

### The 3-5 year success state
If CapNet succeeds, people should say:
- "We don't give agents raw credentials."
- "We mint CapNet capabilities."
- "Every risky action routes through CapNet policies."
- "When something goes wrong, we can prove what happened and shut it down instantly."

That's internet-grade default behavior, not a feature.

---

## 4) The wedge (Phase 0) and why it matters

### Wedge: AI Agent Authorization
Paradigms don't win by being grand; they win by being inevitable through a sharp entry point.

In the next 12–24 months, agents will be deployed widely to take real-world actions. Without a safe delegation layer, credential leakage and agentic overreach will produce large-scale consumer losses, enterprise breaches, and regulatory backlash.

**Phase 0 proves the primitive works.** It's the "ARPANET" — small, functional, undeniable.

### Phase 0 deliverable: "Agent Sandbox Wallet + Proxy"
A working demo that proves:
- **Allowed action succeeds** (e.g., checkout within budget)
- **Forbidden action is blocked** (e.g., alcohol, overspend)
- **Revocation immediately stops** all further action
- **Receipts** provide a human-readable audit trail
- **Delegation attenuation** shrinks authority (optional but recommended)

**Phase 0 must work without:**
- Merchant integration
- OS vendor integration
- OpenAI/Anthropic partnerships
- Global revocation network

**Phase 0's job is: prove the leash works today.**

---

## 5) North Star vision (long‑term)

CapNet becomes the universal authorization substrate: portable, least-privilege, revocable permissions that work across devices, services, enterprises, and eventually OS/hardware boundaries.

**This is "TCP/IP of agency"**: making legitimate authority routable and enforceable like data packets.

### The ladder from wedge to platform
1. **Agent Permission Broker** (Phase 0-1) — Issue time-bound, scope-bound capabilities to agents; step-up approval for high-risk actions; full audit trail
2. **Agent-to-SaaS Policy Layer** — Normalize permissions across common SaaS; enforce least privilege across tools
3. **Cross-org Delegated Trust** — One org grants another org's agents tightly scoped capabilities without raw credentials
4. **Universal Capability Fabric** — The default way networks express trust and collaboration

---

## 6) Near‑term objectives (first ~90 days)

### A) Investor‑grade demo
A 5-minute live demo that is obvious, legible, and hard to argue with:
1. User selects a "Groceries" template ($200/week, stores allow-list, block alcohol)
2. Agent performs shopping and checkout successfully
3. Agent attempts forbidden action → blocked with clear reason
4. User hits revoke → agent immediately cannot proceed
5. Receipts show allowed/denied/revoked events

### B) Pilot‑ready skeleton
A minimal architecture that can be piloted later (enterprise / internal agents):
- Stable key custody
- Policy templates
- Receipts export
- Simple admin controls (can be rudimentary)

### C) Spec + conformance direction
Publish "just enough" spec to enable consistent implementation:
- Canonical capability object representation
- Attenuation rules (monotonicity)
- Revocation modes (strict/lease/one-time)
- Receipt format basics

---

## 7) Non‑goals for Phase 0 (avoid scope creep)

Phase 0 does **not** attempt:
- Universal protocol adoption
- Hardware/TEE attestation enforcement (ok to stub)
- Full KYC/AML credential framework
- Decentralized governance
- Native OS integration
- "Support every website" on day 1

**Phase 0's job is: prove the leash works today.**

---

## 8) Core definitions (must remain consistent)

### Capability
A cryptographically signed permission artifact that authorizes actions on a resource under constraints. It is enforced at a verifier boundary (proxy/gateway/device). Capabilities can be:
- **one-time**
- **lease-based**
- **strict** (must check revocation oracle)

### Policy template
A human-friendly, reusable rule set ("Groceries $200/week, stores allow-list, block alcohol"). Templates compile into capabilities.

### Proxy / Enforcement boundary
The component that enforces capability constraints and prevents overreach. The agent never receives raw credentials.

### Receipts
Signed event records for each attempted action (allowed/denied), including reasons, timestamps, and optionally a capability chain reference.

---

## 9) Threat model (Phase 0)

**Assume:**
- Agents can be buggy or malicious
- Users can be tricked into granting overly broad permissions
- Attackers may attempt replay/exfiltration of capabilities
- Attackers may try to bypass the proxy
- Prompt injection and "confused deputy" failures are inevitable — design for containment

**Phase 0 must protect against:**
- Exceeding spend limits
- Using disallowed vendors/categories
- Actions after revocation
- Replay of one-time permissions
- Credential leakage to agent (the proxy must prevent the agent from ever receiving credentials)

**Phase 0 may defer:**
- Nation-state level attacks
- Coercion/duress recovery flows
- Full device compromise beyond reasonable assumptions

---

## 10) Phase 0 architecture (recommended)

### Delivery mechanism
- **Browser extension** = Wallet UI + "Permission Lens"
- **Local sidecar proxy** = enforcement + key custody + receipts store + local revocation oracle

### High‑level flow
1. Agent requests an action via tool/API call to proxy
2. Proxy asks extension/wallet for capability approval if needed
3. User approves via template UI (minimal prompts)
4. Proxy validates capability + enforces constraints
5. Proxy executes the legacy action via adapters (payment provider / sandbox)
6. Proxy emits receipts (allowed/denied/revocation)
7. User can revoke; proxy enforces instantly

---

## 10.5) How agents act today — transport methods & adapter architecture

### The landscape (2025-2026)

Agents take real-world actions through several transport methods. CapNet must eventually govern all of them:

| Method | How It Works | % of Agent Actions | CapNet Approach |
|--------|-------------|-------------------|-----------------|
| **API / Tool Calling** | Agent calls functions via LangChain, OpenAI function calling, Anthropic tool use, CrewAI, AutoGen. The agent never sees a browser — it's pure API. | ~70-80% (dominant) | **Done.** SDK + proxy intercept. Agent calls proxy instead of API directly. |
| **MCP (Model Context Protocol)** | Anthropic's emerging standard for agent-to-tool communication. Agents discover and use tools through MCP servers. | Growing fast | **Next target.** CapNet becomes an MCP gateway that wraps other MCP servers. Every tool call routes through policy. |
| **Browser Automation** | Playwright, Puppeteer, Anthropic computer use, MultiOn, Browser Use. Agent literally controls a browser — clicks buttons, fills forms. | ~15-20% | Extension intercepts actions. Or proxy acts as HTTP forward proxy. |
| **Desktop / OS Automation** | Screen-reading agents that use mouse/keyboard on any application. Still early but growing. | ~5% | OS-level hooks or driver-layer interception. Future work. |
| **CLI / Terminal** | Agents that execute shell commands (Devin, Claude Code, etc.) | Niche | Shell wrapper that gates commands through policy. |

### Why API-first is the right priority

The industry is trending *away* from browser automation and *toward* structured API calls. When an agent "buys groceries" in production, it won't click through Instacart's website — it'll call Instacart's API. Browser automation is a bridge pattern that exists because APIs don't exist yet for everything agents need to do.

### The transport-agnostic insight

The enforcement pipeline (signature → executor → time → revocation → constraints) doesn't care how the action arrived. It evaluates a capability against a request. What changes between methods is only the **interception layer** — how you capture the agent's intent before it reaches the resource:

```
API call       →  SDK/middleware captures it     →  same enforcement pipeline
MCP tool call  →  MCP gateway captures it        →  same enforcement pipeline
Browser action →  Extension captures it           →  same enforcement pipeline
CLI command    →  Shell wrapper captures it       →  same enforcement pipeline
Desktop action →  OS-level hook captures it       →  same enforcement pipeline
```

The core stays the same. Each transport method gets an **adapter** — an on-ramp to the same enforcement engine. This is what makes CapNet infrastructure and not a product: the primitive is universal, the adapters are how it meets agents where they are.

### The MCP inflection point

MCP is the strategic inflection point. If CapNet becomes the policy layer that wraps MCP servers, then any agent using MCP automatically routes through CapNet policy — without the agent even knowing CapNet is there. That's the "install it and it just works" end state:

```
Phase 0 (now):    Proxy is a service you call explicitly
                  Agent → CapNet Proxy → Resource API

Phase 1 (next):   Proxy wraps real APIs (Stripe, GitHub, etc.)
                  Agent → CapNet Proxy → Stripe API

Phase 2:          Proxy becomes an MCP gateway
                  Agent → MCP → CapNet Policy Layer → MCP Tool Servers
                  (agent doesn't even know CapNet is there)

Phase 3:          Proxy becomes ambient infrastructure
                  Any agent framework auto-discovers CapNet policy
                  Like how HTTPS is invisible but always there
```

---

## 11) Capability model (CapDoc v0.1 — minimal fields)

Phase 0 needs a canonical signed object with:
- version
- capability id
- issuer / subject
- resource identifier
- action verb(s)
- constraints:
  - amount limit
  - vendor allow-list
  - time window / schedule
  - category blocks (for demo)
  - nonce mode (one-time optional)
- revocation mode + pointer (local oracle sufficient)
- executor binding (bind to agent public key; enforce at proxy)
- signature/proof chain (simple for demo)

**Attenuation rule:** derived capabilities MUST only reduce authority (monotone reduction).

---

## 12) Success criteria (definition of "working demo")

The demo is successful if:
- A non-technical viewer understands what happened without deep explanation
- At least one allowed purchase completes
- At least one forbidden purchase attempt is blocked with a clear reason
- Revocation stops the agent within seconds
- Receipts show a timeline of allow/deny/revoke events
- The agent never sees the underlying payment credentials

---

## 13) Messaging guardrails

**Use consistently:**
- "The capability layer for agents"
- "Leash, not master keys"
- "A fence for the agent, not a cage for the user"
- "Templates, not micromanagement"
- "Enforcement boundary prevents damage even if agent is compromised"
- "Scoped, revocable, auditable authority"
- "Power of attorney with limits"
- "The agent can try anything — the proxy decides what executes"
- "Transport-agnostic enforcement — same pipeline, different adapters"

**Avoid (Phase 0):**
- "blockchain"
- "decentralized utopia"
- "replace the internet"
- Positioning as "security tooling" (we're infrastructure, not a feature)
- **"firewall"** — CapNet does not monitor all traffic; it only governs agent actions
- **"surveillance" / "DLP" / "content filter"** — CapNet is not watching the user
- **"parental controls"** — CapNet restricts the agent, never the human

---

## 14) Immediate build focus

The **spend sandbox** is the strongest "head-turner" for investors. Demonstrate money controls first. Email/calendar can follow.

---

## 15) Design principles (inform every decision)

These principles should guide all implementation choices:

1. **Primitives over products** — Build atoms others can compose, not monolithic features
2. **Developer-first packaging** — Drop-in, sane defaults, works in the messy real world
3. **Opinionated safety from day one** — Platforms get punished for insecure extensibility
4. **Interop with what exists** — SSH, Kubernetes, service meshes, identity, zero-trust stacks
5. **Assume breach** — Design for containment, not prevention alone
6. **Audit as a first-class citizen** — "Why did this happen?" must always be answerable
7. **Bottoms-up adoption** — A single engineer should be able to adopt without committee approval

---

## 16) Brand note

"CapNet" has name collisions (healthcare research network, academic consortium, "Capability Enabled Networking"). This is a real consideration for mindshare. May need to address before major public launch, but not blocking for Phase 0.

---

## 17) Implementation status (as of 2026-02-10)

### Phase 0 Core: COMPLETE ✓

**Demo verified on:** Windows 11, macOS, Linux (WSL2)

| Component | Status | Notes |
|-----------|--------|-------|
| CapDoc v0.1 schema | Done | Zod, Ed25519 signatures, cross-field validation |
| Proxy enforcement | Done | Budget, vendor, category, time, executor, revocation |
| Sandbox merchant | Done | 16-item catalog, cart, checkout, orders |
| Chrome extension | Done | Templates, Active Caps, Receipts, agent identity |
| SDK client | Done | All endpoints, timeouts, demo script |
| Audit trail | Done | Receipts with event types, denial reasons |
| Cross-platform scripts | Done | Windows/macOS/Linux compatible |

### Critical Blocker: RESOLVED

The extension now generates and persists real Ed25519 agent keypairs instead of using a hard-coded zero pubkey. This enables proper testing of:
- Executor binding enforcement
- Multiple agent identities
- Executor mismatch denial
- Meaningful receipt attribution

### Ready to Test

The demo story works end-to-end:
1. User issues capability via template UI
2. Agent makes allowed purchase → ALLOWED
3. Agent attempts blocked category → DENIED (category_blocked)
4. User revokes capability
5. Agent attempts any action → DENIED (revoked)
6. Receipts show complete audit trail

### Remaining for Phase 0+

- Attenuation/delegation (derive sub-capabilities)
- Demo polish (investor mode)
- Conformance tests

### Phase 1 Integration Targets (pick one to prove "not a toy")

After sandbox demo, prove CapNet gates something real:

| Option | Complexity | Investor Impact |
|--------|------------|-----------------|
| **Stripe test-mode** | Medium | "Real money rails, scoped" |
| **GitHub API** | Low | "Agent can't delete repos" |
| **Google Workspace** | Medium | "Agent can read calendar, not delete" |
| **Slack** | Low | "Agent posts to #general, not #executive" |

**Recommendation:** Stripe test-mode is highest impact for "agent spending" narrative continuity. GitHub is lowest friction to implement.

---

## 18) Technical hardening applied

### TypeScript (security-grade)
- `noUncheckedIndexedAccess` — prevents undefined access bugs
- `exactOptionalPropertyTypes` — stricter optional handling
- `useUnknownInCatchVariables` — safer error handling
- `noImplicitOverride` — explicit inheritance

### Extension
- Zod schema validation on all API responses
- Agent identity with format validation
- Storage versioning for migration
- Clipboard error handling

### Shared package
- Exports map for modern bundlers
- Pinned dependencies (no version drift)
- sideEffects:false for tree-shaking

### Proxy
- Signature verification before trusting any cap fields
- Correct verification order (signature → executor → time → revocation → constraints)
- Safe date parsing
- CORS scoped to extension + localhost

---

## 19) Investor FAQ

### "Agent spending seems meh—what makes this next level?"

> "Spending is the easiest way to show the primitive. The investment isn't groceries—it's the **control plane for delegated authority**. Today, either you give an agent raw credentials or you don't let it act. CapNet creates a third option: safe delegation with immediate revocation + provable audit. Once that exists, it becomes the default way any system accepts agent actions."

### "How is this different from OAuth/IAM?"

> "OAuth answers 'who is this?' CapNet answers 'what can this agent do right now, and can I stop it?' OAuth is identity. CapNet is scoped, revocable, auditable authority with enforcement at the boundary."

### "Why will developers adopt this?"

> "Same reason they adopted HTTPS: it's the only way to do it safely. When agents routinely take real-world actions, 'give it my API key' stops being acceptable. CapNet is the path that doesn't require trusting the agent."

### "What's the moat?"

> "First-mover on the primitive + spec. If CapNet becomes how you express agent permissions, we're the TCP/IP of agency. The moat is the standard, not the implementation."

### "Isn't this just a firewall?"

> "No. A firewall monitors all traffic — yours, your agent's, everyone's. CapNet only governs the agent. The human can still do whatever they want. It's a fence for the agent, not a cage for the user. The user sets the policy, the user controls revocation, the user retains full authority. CapNet enforces the boundaries they choose to delegate."

### "What about agents that use browsers or desktop apps, not just APIs?"

> "Today ~80% of agent actions are API-based, and that's our priority. But the enforcement pipeline is transport-agnostic — it doesn't care whether the action came from an API call, a browser extension, an MCP tool, or a CLI command. The same policy engine evaluates the same capability. We add adapters for each transport method. The strategic inflection point is MCP (Model Context Protocol) — if CapNet wraps MCP servers, every agent using MCP gets policy enforcement automatically, without even knowing CapNet is there."
