# CapNet — Behavioral Intelligence Roadmap

> Design specification for evolving CapNet from manual policy enforcement to intelligent, adaptive agent governance.

---

## 0) Why This Roadmap Exists

Phase 0 proves the primitive works: signed capabilities, deterministic enforcement, instant revocation, audit trail. But manual policy authoring doesn't survive contact with real-world agent deployments. No one will hand-craft constraint sets for dozens of agents across dozens of services.

The behavioral intelligence roadmap defines how CapNet evolves from **"user writes the rules"** to **"system understands the rules"** — without losing the hard enforcement guarantees that make CapNet valuable.

### The constraint

Every feature in this roadmap must preserve the core principle: **the enforcement boundary is deterministic and cryptographic.** Intelligence layers advise, flag, and auto-pause — they never override the policy engine. The 7-step enforcement pipeline remains the source of truth. Behavioral intelligence sits alongside it, not above it.

---

## 1) The Foundational Asset: The Receipt Stream

Everything CapNet does already generates structured, signed receipts — every allowed action, every denial, every revocation. This is not just an audit trail. **It's a behavioral dataset that no one else has.**

Every other security product infers what agents did from logs after the fact. CapNet has a real-time, cryptographically signed stream of exactly what every agent attempted, what was allowed, what was denied, and why.

### Receipt fields available for analysis

| Field | Intelligence use |
|-------|-----------------|
| `timestamp` | Temporal patterns, velocity detection |
| `event_type` | Action mix (allowed vs denied ratio) |
| `cap_id` | Per-capability behavioral profiles |
| `agent_pubkey` | Per-agent behavioral profiles |
| `action.vendor` | Vendor distribution, new-vendor detection |
| `action.category` | Category mix patterns |
| `action.amount_cents` | Amount distribution, statistical outliers |
| `denial_reason` | Attempted-but-blocked pattern analysis |
| `resource_id` | Cross-service usage patterns |

**Key insight:** Denied actions are as valuable as allowed ones. An agent that repeatedly tests constraint boundaries is exhibiting different behavior than one that stays well within its envelope. The denial stream is a signal.

---

## 1.5) The NL Engine: LLM as Hidden Infrastructure

### The principle

CapNet needs natural language understanding for policy generation, anomaly explanation, conversational interaction, and contextual reasoning. Rather than building a proprietary language model, CapNet integrates public LLMs (Claude, GPT, etc.) as a **background reasoning layer** — invisible to the user, powering the product's intelligence.

**The user interacts with CapNet. CapNet talks to the LLM behind the scenes. The LLM never faces the user directly.**

This is the Notion/Slack model, not the plugin model. Notion uses AI — but users think "Notion is smart," not "I'm using Claude through Notion." CapNet should work the same way. The intelligence feels native. The brand relationship is with CapNet.

### Why not expose the LLM directly?

If the primary interface is "talk to Claude through CapNet tools," CapNet feels like a plugin for someone else's product. The user's relationship is with Claude, not with CapNet. And when Anthropic or OpenAI inevitably builds their own governance features, users don't even notice CapNet disappearing — because they were never attached to it in the first place.

By keeping the LLM behind CapNet's own interface, users associate the intelligence with CapNet. "CapNet understood what I needed" — not "Claude understood what I needed through CapNet."

### What the NL Engine does

| Function | How the LLM is used | What the user sees |
|----------|---------------------|-------------------|
| **Policy generation** | User describes agent purpose in CapNet UI → NL Engine translates to draft CapDoc constraints | "CapNet suggested a policy for my travel agent" |
| **Anomaly explanation** | Scoring engine produces numbers + contributing factors → NL Engine turns them into plain language | "CapNet flagged unusual behavior and explained why" |
| **Conversational policy editing** | User says "also add Marriott to the vendor list" → NL Engine resolves to CapDoc modification | "I told CapNet to adjust the policy and it did" |
| **Risk narration** | Blast radius data → NL Engine generates human-readable risk summary | "CapNet showed me my exposure in plain English" |
| **Receipt summarization** | Raw receipt stream → NL Engine produces daily/weekly behavioral summaries | "CapNet gives me a digest of what my agents did" |

### What the NL Engine explicitly does NOT do

This boundary is non-negotiable:

- **Never makes enforcement decisions.** The 7-step deterministic pipeline decides allow/deny. The NL Engine cannot override, bypass, or influence it.
- **Never evaluates capabilities.** Capability validation is cryptographic and schema-based. The LLM doesn't touch it.
- **Never scores anomalies.** The statistical scoring model produces anomaly scores. The LLM only translates scores into explanations.
- **Never manages cryptographic material.** Key generation, signing, verification — all deterministic, no LLM involvement.
- **Never produces receipts.** Receipts are signed, structured records from the enforcement engine. The LLM may summarize them but never creates them.

**If the LLM is compromised (prompt injection, jailbreak, hallucination), the worst outcome is bad advice — never bad enforcement.** The enforcement boundary holds regardless of LLM state. This is a fundamental security property.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CapNet Platform                          │
│                                                                 │
│  ┌──────────────┐   ┌───────────────┐   ┌───────────────────┐  │
│  │  CapNet UI   │   │    Proxy      │   │    NL Engine      │  │
│  │              │   │               │   │                   │  │
│  │  · wallet    │◄──┤  · enforce-   │◄──┤  · NL → CapDoc   │  │
│  │  · dashboard │   │    ment       │   │  · Data → English │  │
│  │              │──►│  · scoring    │──►│  · Session state  │  │
│  │              │   │  · receipts   │   │                   │  │
│  └──────────────┘   └───────────────┘   └─────────┬─────────┘  │
│                                                    │            │
│                                          ┌─────────┴─────────┐  │
│                                          │   LLM Provider    │  │
│                                          │   (Claude / GPT)  │  │
│                                          │   via API key     │  │
│                                          └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### LLM provider model

Users bring their own API key — same pattern as OpenClaw. CapNet doesn't eat inference costs; the user's existing Claude or OpenAI subscription handles it.

**Configuration:**

```typescript
interface NLEngineConfig {
  provider: "anthropic" | "openai" | "custom";
  model: string;                      // e.g., "claude-sonnet-4-6", "gpt-4o"
  
  // API key loaded from environment variable (CAPNET_LLM_API_KEY)
  // Do NOT store in config files or in the proxy's data/ directory.
  // Environment variables are the standard approach and avoid
  // building encryption infrastructure we don't have yet.
  
  // Optional: hosted tier where CapNet provides LLM access
  use_hosted: boolean;                // default: false
  
  // Safety
  max_tokens_per_request: number;     // prevent runaway costs
  rate_limit_per_minute: number;      // protect user's API quota
}
```

**Tier options (future):**

| Tier | LLM access | Cost model |
|------|-----------|------------|
| **BYOK (Bring Your Own Key)** | User provides Claude/GPT API key | User pays LLM provider directly |
| **Hosted** | CapNet provides LLM access as part of subscription | Bundled into CapNet pricing |
| **Offline** | No LLM — manual templates only, no NL features | Free / base tier |

The offline tier ensures CapNet works without any LLM dependency. All enforcement, scoring, and receipt functionality is fully operational without the NL Engine. The LLM makes the experience better — it doesn't make the product functional.

### System prompt architecture

The NL Engine uses a constrained system prompt that defines its role within CapNet:

```
You are the reasoning layer inside CapNet, an agent governance platform.

Your role:
- Translate user intent into CapDoc constraint structures
- Explain anomaly scores and behavioral data in plain language
- Summarize receipts and agent activity
- Suggest policy adjustments based on usage patterns

Your boundaries:
- You NEVER make enforcement decisions. The proxy decides allow/deny.
- You NEVER evaluate whether an action should be permitted.
- You NEVER generate or handle cryptographic material.
- You NEVER produce receipts or audit records.
- You translate between human language and CapNet's structured operations.

When suggesting policies, err toward tighter constraints. Explain when
you're being conservative and offer the user the option to loosen.

The user is talking to CapNet, not to you. Respond as CapNet's interface,
not as an independent assistant.
```

### Where the NL Engine lives

**Recommended: A new module in the proxy service** (`proxy/src/nl-engine.ts`) that:
- Accepts structured requests from the UI and other proxy endpoints
- Calls the configured LLM provider
- Returns structured + natural language responses
- Never touches the enforcement pipeline

**Note:** `nl-engine.ts` is the correct starting point — a single file with provider abstraction, system prompt, and request/response handling. Once conversational refinement ships (session context for follow-up policy edits), this will outgrow a single file and should become `proxy/src/nl-engine/` with separate modules for providers, prompts, and session state. Don't build the directory structure prematurely — but design the initial module with that migration in mind (clean exports, separated concerns internally).

The NL Engine is called by proxy endpoints that need reasoning:
- `POST /capability/suggest` calls NL Engine for policy generation
- `GET /agent/:pubkey/blast-radius` calls NL Engine for risk narration
- `GET /receipts/summary` (new) calls NL Engine for activity digests
- Anomaly notification formatter calls NL Engine for plain-language alerts

---

## 1.6) Agent-Agnostic Positioning

### The principle

**CapNet is agent-agnostic. Use whatever agent you want — we just make it safe.**

This is as fundamental to CapNet's identity as "not a firewall." CapNet does not care what agent framework the user runs. It doesn't prefer Claude over GPT, OpenClaw over LangChain, AutoGen over CrewAI. It doesn't require agents to be "CapNet-compatible." The enforcement proxy works with any agent that makes API calls, because it operates at the boundary, not inside the agent.

### What this means concretely

- **No agent lock-in.** CapNet never requires a specific agent framework, LLM provider, or orchestration tool.
- **No agent awareness.** The proxy doesn't know (or care) what agent is behind the requests. It sees a capability token, an action request, and a signature. That's it.
- **No framework partnerships required for Phase 0-1.** CapNet works with any agent that can make HTTP calls. OpenClaw integration (Phase 1) is the first proof point, not the only target — it demonstrates that CapNet works with a real agent framework while the architecture ensures it works with any of them. The OpenClaw integration should be built in a way that makes the pattern obviously replicable for LangChain, AutoGen, CrewAI, or any other framework.
- **No opinion on agent design.** CapNet doesn't care if the agent uses function calling, MCP, chain-of-thought, ReAct, or a simple script. The enforcement boundary is transport-agnostic (see CAPNET_CONTEXT.md Section 10.5).

### Why this matters strategically

If CapNet is tied to one agent framework, it's a feature of that framework — not infrastructure. To become the TCP/IP of agency, CapNet must be the governance layer for the **entire agentic ecosystem**, not one vendor's agents.

When an AI lab asks "why should we recommend CapNet?" the answer is: **because CapNet is neutral.** It makes every agent safer without picking winners. It doesn't compete with any agent framework. It complements all of them.

### The distinction from the NL Engine

The NL Engine (Section 1.5) uses a specific LLM (Claude or GPT) behind the scenes — but that's **CapNet's internal tooling choice**, not the user's constraint. The LLM powers CapNet's interface intelligence. It has nothing to do with which agent the user deploys.

A user can:
- Configure CapNet's NL Engine to use Claude (for CapNet's own intelligence)
- Deploy agents built on GPT-4, LangChain, and AutoGen (for their actual work)
- Have all of those agents governed by the same CapNet enforcement proxy

The LLM inside CapNet and the LLM inside the user's agent are completely independent. They don't need to be the same provider, the same model, or even aware of each other.

### What CapNet is NOT (agent edition)

These extend the "What CapNet is NOT" list from CAPNET_CONTEXT.md Section 1. **Consolidation note:** The "What CapNet is NOT" pattern now appears in CAPNET_CONTEXT.md (Sections 1 and 4) and here. Before public launch, these should be consolidated into a single canonical list in CAPNET_CONTEXT.md. For now, keeping them close to the relevant context is more useful than premature consolidation.

- **Not an agent framework.** CapNet doesn't build, host, or orchestrate agents.
- **Not an agent marketplace.** CapNet doesn't recommend, rank, or distribute agents.
- **Not an LLM router.** CapNet doesn't decide which model handles a user's request.
- **Not a competing product to any agent.** CapNet makes agents safer. It doesn't replace them.

---

## 2) Stage 1: Intelligent Policy Generation

> **Timeline:** 2-3 weeks of focused work after Phase 1 (OpenClaw integration)
> **Depends on:** CapDoc v0.1 schema (done), template system (done)
> **Produces:** "Smart Templates" upgrade to extension + SDK

### The problem

Users currently configure capability templates manually — selecting budget limits, vendor lists, time windows, category blocks. This works for a demo. It doesn't work for a user deploying agents across 15 SaaS tools.

### The solution

The user describes what the agent is for in natural language. The system generates a draft CapDoc with appropriate constraints. The user reviews and approves.

**The user moves from _author_ to _approver_.** This preserves the "user retains full authority" principle while eliminating the UX friction.

### Architecture

```
User input (natural language)
    │
    ▼
┌──────────────────────────────┐
│  Policy Generation Service   │
│                              │
│  Input: agent description,   │
│         available resources, │
│         reference policies   │
│                              │
│  Output: draft CapDoc with   │
│          constraints filled  │
│          + risk explanation  │
└──────────────────────────────┘
    │
    ▼
User review UI
    │  (approve / edit / reject)
    ▼
Proxy issues capability (existing flow)
```

### Implementation

- **NL Engine integration.** The `POST /capability/suggest` endpoint routes through the NL Engine (Section 1.5), which calls the user's configured LLM provider. The CapDoc schema (Zod) defines the structured output format. The NL Engine's system prompt constrains the LLM to generate valid constraint values, erring toward tighter defaults.
- **Reference policy library.** A curated set of known-good policies for common use cases (travel booking, expense management, code deployment, calendar access, communication). These serve as few-shot examples in the NL Engine prompt and as calibration anchors for constraint values.
- **Risk annotation.** Each generated policy includes a plain-language risk summary produced by the NL Engine: "This agent can spend up to $X per day across Y vendors. Maximum blast radius if compromised: $Z over the remaining lease period." The user sees the worst case before approving.
- **Constraint tightening bias.** Encoded in the NL Engine's system prompt: when uncertain, err toward tighter constraints. The NL Engine explains when it's being conservative and offers the user the option to widen specific constraints through conversational follow-up.
- **Conversational refinement.** After the initial suggestion, users can adjust via natural language in the CapNet UI: "also add Marriott to the vendor list" or "make it $3,000 instead." The NL Engine maintains session context and produces updated CapDoc drafts. The user approves the final version.

### Where it lives

**`POST /capability/suggest` on the proxy**, called by both the extension UI and the SDK. Internally routes through the NL Engine module (`proxy/src/nl-engine.ts`). Returns a draft CapDoc + risk annotation + conversational context ID for follow-up refinement.

If no LLM provider is configured (offline tier), this endpoint returns an error directing the user to the manual template UI. Policy generation is an NL Engine feature, not a core enforcement feature — CapNet works without it.

### Endpoint spec

```
POST /capability/suggest

Request:
{
  "agent_description": "Manage team travel and expenses for Q3 offsite",
  "agent_pubkey": "<base64>",
  "resources": ["stripe", "google_workspace", "slack"],
  "risk_tolerance": "moderate"   // low | moderate | high
}

Response:
{
  "draft_capdoc": { /* CapDoc v0.1 with constraints populated */ },
  "risk_summary": "This agent can spend up to $5,000 across travel and dining vendors...",
  "blast_radius": {
    "max_financial_exposure_cents": 500000,
    "resource_count": 3,
    "lease_remaining_hours": 168
  },
  "confidence": 0.82,
  "tightening_notes": [
    "Budget set to $5,000 (conservative for team travel). Increase if booking flights.",
    "Vendor list restricted to known travel platforms. Add specific vendors if needed."
  ]
}
```

---

## 3) Stage 2: Behavioral Baseline Learning

> **Timeline:** Build infrastructure during Phase 1; baselines become useful once real agents generate receipt volume
> **Depends on:** Receipt stream (done), at least one real integration producing receipts
> **Produces:** Per-agent and per-capability behavioral profiles stored at the proxy

### The concept

Once agents operate under capabilities, the receipt stream produces behavioral data. The system observes patterns across multiple dimensions and builds a "normal" model for each agent.

### Baseline dimensions

| Dimension | What's tracked | Data source |
|-----------|---------------|-------------|
| **Temporal** | When does this agent typically act? Hour-of-day distribution, day-of-week patterns, burst vs steady cadence | `receipt.timestamp` |
| **Velocity** | How many actions per hour/day/week? What's the inter-action interval distribution? | `receipt.timestamp` sequence |
| **Financial** | What's the typical transaction size? What's the distribution shape (tight cluster vs wide spread)? What's the cumulative daily/weekly spend curve? | `action.amount_cents` |
| **Vendor/Resource** | Which services does it hit? In what proportions? Does it stick to a consistent set or drift? | `action.vendor`, `resource_id` |
| **Categorical** | What mix of action types? What's the allowed/denied ratio? Does it frequently test boundaries? | `action.category`, `event_type`, `denial_reason` |
| **Sequential** | Are there typical action sequences? (e.g., always checks calendar before booking travel) | Ordered receipt sequences |

### Where it runs

**At the proxy layer.** The proxy already sees every action. Adding a lightweight statistical model that updates on each receipt and scores each new action against the baseline is computationally cheap and architecturally simple.

No separate service. No GPU. No large model. Running statistics, distribution tracking, and deviation scoring.

### Data structure

```typescript
interface AgentBaseline {
  agent_pubkey: string;
  
  // Temporal
  hourly_distribution: number[];     // 24 buckets, normalized
  daily_distribution: number[];      // 7 buckets, normalized
  avg_actions_per_day: number;
  actions_per_day_stddev: number;
  
  // Financial
  amount_mean_cents: number;
  amount_stddev_cents: number;
  amount_percentiles: {              // p10, p25, p50, p75, p90, p99
    [key: string]: number;
  };
  cumulative_daily_spend_avg: number;
  
  // Vendor/Resource
  vendor_distribution: {             // vendor → frequency proportion
    [vendor: string]: number;
  };
  known_vendors: string[];             // vendors seen at least N times (not Set — must serialize to JSON)
  resource_distribution: {
    [resource: string]: number;
  };
  
  // Categorical
  category_distribution: {
    [category: string]: number;
  };
  denial_rate: number;               // denied / total over window
  boundary_test_rate: number;        // actions within 10% of constraint limits
  
  // Metadata
  sample_count: number;
  first_observation: string;         // ISO timestamp
  last_observation: string;
  baseline_confidence: number;       // 0-1, increases with sample count
  window_days: number;               // rolling window size
}
```

### Warm-up period

A baseline is meaningless with 5 data points. The system should have a defined warm-up period (configurable, default: 50 actions or 7 days, whichever comes first) during which:
- Baseline is being built but not yet used for scoring
- All actions are flagged as `baseline_status: "warming_up"` in receipts
- The user dashboard shows "Learning agent behavior... (32/50 actions observed)"

After warm-up, the baseline becomes active and anomaly scoring begins.

### Update mechanics

- **Rolling window:** Baselines use a configurable rolling window (default: 30 days). Older observations decay. This allows natural behavioral evolution without triggering false positives.
- **Update frequency:** Baseline statistics update on every receipt (incremental, not batch).
- **Drift detection:** If the baseline itself is shifting rapidly (agent behavior is changing), flag this as a meta-signal. Gradual drift is normal. Sudden baseline shift is suspicious.

### Storage

Baselines stored in `data/baselines.json` (same pattern as `caps.json`). Keyed by `agent_pubkey`. Persists across proxy restarts.

---

## 4) Stage 3: Anomaly Scoring and Adaptive Response

> **Timeline:** Builds directly on Stage 2. Once baselines exist, anomaly scoring is an addition to the enforcement pipeline.
> **Depends on:** Stage 2 baselines with sufficient warm-up data
> **Produces:** Per-action anomaly score, graduated response system, user notifications

### How it works

Every action request gets an **anomaly score** alongside the deterministic policy check. The policy check is binary (allowed/denied). The anomaly score is continuous (0.0 = perfectly normal, 1.0 = extreme deviation).

### Scoring model

The anomaly score is a weighted composite of per-dimension deviation scores:

```
anomaly_score = Σ (weight_i × deviation_i) / Σ weight_i

where deviation_i = f(observed_value, baseline_distribution_i)
```

| Dimension | Deviation function | Weight (default) |
|-----------|-------------------|------------------|
| Temporal | How unusual is the current hour/day for this agent? | 0.10 |
| Velocity | How does current action rate compare to baseline? | 0.20 |
| Financial | How many standard deviations from mean amount? | 0.25 |
| Vendor | Is this a known vendor? How unusual in the distribution? | 0.20 |
| Category | How unusual is this category mix in recent window? | 0.10 |
| Sequential | Does this action follow expected patterns? | 0.05 |
| Cross-cap | Is the agent exercising multiple capabilities unusually? | 0.10 |

**Weights are configurable per capability.** A financial trading agent should weight financial deviation higher. A calendar agent should weight temporal patterns higher.

### Graduated response

| Anomaly score | Response | User impact |
|---------------|----------|-------------|
| 0.0 – 0.3 | **Normal.** Proceed. Log score in receipt. | None |
| 0.3 – 0.6 | **Elevated.** Proceed. Flag in receipt. Async notification to user. | User sees yellow indicator in wallet |
| 0.6 – 0.8 | **High.** Auto-pause capability. Require human re-authorization. | Agent blocked until user confirms |
| 0.8 – 1.0 | **Critical.** Immediate revocation. Alert user. | Agent fully stopped, all caps for this agent frozen |

**Thresholds are configurable per capability** via a new `anomaly_policy` field in the CapDoc:

```typescript
interface AnomalyPolicy {
  enabled: boolean;                  // default: true after warm-up
  thresholds: {
    elevated: number;                // default: 0.3
    high: number;                    // default: 0.6
    critical: number;                // default: 0.8
  };
  weights: {                         // override default dimension weights
    [dimension: string]: number;
  };
  auto_pause: boolean;               // default: true at high threshold
  auto_revoke: boolean;              // default: true at critical threshold
  notify_on_elevated: boolean;       // default: true
}
```

### Receipt enrichment

Every receipt gains new fields:

```typescript
interface EnrichedReceipt {
  // ... existing receipt fields ...
  
  anomaly: {
    score: number;                   // 0.0 - 1.0
    level: "normal" | "elevated" | "high" | "critical";
    contributing_factors: {
      dimension: string;
      deviation: number;
      explanation: string;           // "Amount $847 is 3.2σ above mean of $42"
    }[];
    baseline_status: "warming_up" | "active" | "insufficient_data";
    action_taken: "none" | "flagged" | "paused" | "revoked";
  };
}
```

### Human-readable explanations

The wallet UI (and any dashboard) shows anomaly flags in plain language. The NL Engine (Section 1.5) transforms the structured `contributing_factors` array into natural sentences:

> ⚠️ **Elevated anomaly (0.47)** — This agent typically makes 3-5 purchases per day averaging $42. In the last 2 hours, it has attempted 11 purchases averaging $180 across 3 vendors it has never used before.

The scoring engine produces the numbers. The NL Engine produces the words. If no LLM is configured (offline tier), the system falls back to template-based explanations generated directly from the contributing factors (e.g., "Amount $180 is 3.2σ above baseline mean of $42"). Less natural, but fully functional.

### Enforcement pipeline update

The 7-step enforcement pipeline does not change. Anomaly scoring is a **parallel evaluation**, not a replacement:

```
Action Request arrives
    │
    ├──► 7-step deterministic check (existing, unchanged)
    │       │
    │       ├── DENIED → emit receipt with denial reason + anomaly score
    │       │
    │       └── ALLOWED → continue to anomaly check
    │
    └──► Anomaly scoring (new, parallel)
            │
            ├── score < elevated threshold → PROCEED (emit receipt with score)
            │
            ├── score ≥ elevated threshold → PROCEED + FLAG (emit receipt + notify)
            │
            ├── score ≥ high threshold → PAUSE capability (emit receipt + require re-auth)
            │
            └── score ≥ critical threshold → REVOKE capability (emit receipt + alert)
```

An action that passes all 7 deterministic checks can still be paused or revoked by the anomaly system. An action that fails deterministic checks is denied regardless of anomaly score (the anomaly score is still logged for analysis).

---

## 5) Stage 4: Aggregate Blast Radius Analysis

> **Timeline:** Can be built in parallel with Stages 2-3 (dashboard + aggregation layer)
> **Depends on:** Capability storage (done), receipt stream (done)
> **Produces:** Per-agent blast radius map, cross-capability anomaly detection

### The problem

A hijacked agent doesn't care about your grocery budget. It cares about the **combined authority** across every capability it holds — Stripe, GitHub, AWS, Slack, email, CRM. The current system evaluates capabilities individually. The threat model needs to account for the aggregate envelope.

### Blast radius computation

For each agent identity, the system maintains a real-time aggregate view:

```typescript
interface AgentBlastRadius {
  agent_pubkey: string;
  
  capabilities: {
    cap_id: string;
    resource: string;
    max_financial_exposure_cents: number;
    remaining_budget_cents: number;
    time_remaining_hours: number;
    action_types: string[];
    is_active: boolean;
  }[];
  
  aggregate: {
    total_financial_exposure_cents: number;
    total_remaining_budget_cents: number;
    resource_count: number;
    action_type_count: number;
    earliest_expiry: string;
    latest_expiry: string;
  };
  
  risk_score: number;                // composite risk based on aggregate exposure
  risk_explanation: string;          // "This agent can spend $12,400 across 7 services..."
}
```

### Cross-capability anomaly detection

Individual capability anomaly scores may be low, but cross-capability patterns can reveal compromise:

| Signal | What it means |
|--------|--------------|
| Agent exercises capabilities across 5+ services within 10 minutes after weeks of using 1-2 | Possible credential theft — attacker exploring the envelope |
| Agent's financial actions spike across multiple capabilities simultaneously | Coordinated exfiltration attempt |
| Agent begins using capabilities it holds but has never previously exercised | Dormant capability activation — common in hijacking |
| Agent's action patterns become highly regular (exact intervals, identical amounts) | Bot-like behavior replacing human-directed agent |

These cross-capability signals feed into the anomaly scoring model as the `cross_cap` dimension (weighted at 0.10 by default, but should be higher for agents with broad authority).

### Dashboard

The blast radius map is primarily a **user-facing dashboard feature**:

- Visual showing all capabilities held by an agent, grouped by resource
- Total exposure calculation updated in real-time
- "What if compromised?" summary: worst-case financial loss, data access scope, action scope
- One-click "kill all" button: revokes every capability for an agent identity

### Endpoint spec

```
GET /agent/:pubkey/blast-radius

Response:
{
  "agent_pubkey": "<base64>",
  "capabilities": [ ... ],
  "aggregate": {
    "total_financial_exposure_cents": 1240000,
    "total_remaining_budget_cents": 873200,
    "resource_count": 7,
    "action_type_count": 14,
    "earliest_expiry": "2026-04-01T00:00:00Z",
    "latest_expiry": "2026-06-30T00:00:00Z"
  },
  "risk_score": 0.72,
  "risk_explanation": "This agent holds 7 active capabilities across Stripe, GitHub, Google Workspace, Slack, AWS, Jira, and Notion. Maximum financial exposure is $12,400. It can read/write code repositories, send messages as you, and modify cloud infrastructure. Recommend narrowing scope or splitting into purpose-specific agent identities."
}
```

---

## 6) Stage 5: Proof-of-Claim as Ground Truth

> **Timeline:** 12-18 months out. Depends on Proof-of-Claim protocol being operational.
> **Depends on:** Stages 2-3 active, Proof-of-Claim Layer V3+ implemented
> **Produces:** Verified outcome feed, trust calibration, closed-loop governance

### The convergence

The behavioral system (Stages 2-3) can detect *unusual* patterns, but it can't know whether outcomes were *real*. The Proof-of-Claim Layer provides the ground truth signal.

### What is the Proof-of-Claim Layer?

The Proof-of-Claim Layer is a separate protocol (designed alongside CapNet but developed independently) for verifying real-world claims. It's a network where claims about the physical world — "this shipment maintained temperature," "this contractor completed the work," "this agent's purchase resulted in a real delivery" — are published with evidence, staked by attestors who put reputation and money on the line, independently corroborated, and composed into queryable confidence scores. It doesn't assert truth; it asserts *confidence with provenance and consequence*. The protocol defines four operations: CLAIM (publish a staked claim), QUERY (get confidence state), DISCLOSE (request private evidence), and DISPUTE (challenge a claim). The full specification is maintained in a separate concept brief (Proof-of-Claim Layer V3). For CapNet's purposes, the relevant interface is the QUERY operation — asking "how confident should I be that this agent's reported outcome actually happened?"

### How they connect

```
Agent action → CapNet allows → Agent reports outcome
                                        │
                                        ▼
                              Proof-of-Claim attestation
                              (sensor, counterparty, or inspector
                               independently verifies outcome)
                                        │
                                        ▼
                              Confidence score returned
                                        │
                                        ▼
                              Fed back into agent baseline
                                        │
                                ┌───────┴───────┐
                                │               │
                         Verified outcome   Unverified/disputed
                                │               │
                          Trust increases   Anomaly sensitivity
                          Leash loosens     increases, leash
                          over time         tightens
```

### Trust calibration model

```typescript
interface AgentTrustProfile {
  agent_pubkey: string;
  
  verification_history: {
    total_actions: number;
    verified_outcomes: number;        // confirmed by Proof-of-Claim attestations
    unverified_outcomes: number;      // no attestation received within window
    disputed_outcomes: number;        // attestation contradicts claimed outcome
    verification_rate: number;        // verified / total
  };
  
  trust_score: number;                // 0.0 - 1.0, derived from verification history
  trust_level: "new" | "provisional" | "established" | "trusted";
  
  anomaly_sensitivity_modifier: number;  // multiplier on anomaly thresholds
                                         // new agent: 1.5x (tighter)
                                         // trusted agent: 0.7x (looser)
  
  auto_policy_suggestions: {
    // System suggests loosening constraints for trusted agents
    suggestion: string;
    current_value: any;
    suggested_value: any;
    confidence: number;
  }[];
}
```

### Trust levels

| Level | Criteria | Anomaly sensitivity | Policy suggestion |
|-------|----------|--------------------|--------------------|
| **New** | < 50 actions or < 7 days | 1.5× (tighter thresholds) | None — too early |
| **Provisional** | 50+ actions, > 80% verified, 0 disputes | 1.0× (default) | May suggest minor loosening |
| **Established** | 200+ actions, > 90% verified, < 2% disputed | 0.8× (slightly looser) | Suggests efficiency improvements |
| **Trusted** | 500+ actions, > 95% verified, < 1% disputed, 90+ days history | 0.7× (meaningfully looser) | Suggests broader scope where warranted |

**Trust degrades faster than it builds.** A single disputed outcome at "trusted" level drops to "provisional" immediately. Trust is asymmetric by design — this is a security system.

### The closed loop

Once all five stages are operational, the system forms a self-improving cycle:

1. **Policy generation** creates appropriate constraints (Stage 1)
2. **Behavioral baselines** learn what "normal" looks like (Stage 2)
3. **Anomaly detection** catches deviations in real-time (Stage 3)
4. **Blast radius analysis** tracks aggregate exposure (Stage 4)
5. **Proof-of-Claim verification** confirms real-world outcomes (Stage 5)
6. **Trust calibration** adjusts sensitivity based on verified history (Stage 5)
7. **Policy refinement** suggests tighter or looser constraints based on learned behavior and trust (Stages 1 + 5 feedback loop)

The system gets smarter with every action, every verification, and every dispute. And the data asset — the combined receipt + attestation stream — compounds over time in a way that's extremely difficult to replicate.

---

## 7) Implementation Sequence

> **IMPORTANT: These timelines begin AFTER Phase 1 (OpenClaw integration) is complete.** Phase 1 is the current development priority and is not superseded by this roadmap. The behavioral intelligence work described here builds on the real agent volume and integration patterns that Phase 1 produces. Do not start NL Engine or baseline infrastructure work until the OpenClaw integration is shipping and generating receipts.

| Stage | What | Depends on | Timeline | Effort |
|-------|------|-----------|----------|--------|
| **NL Engine** | LLM integration module | LLM provider API access | 1-2 weeks | `proxy/src/nl-engine.ts` + config |
| **1** | Intelligent Policy Generation | NL Engine + CapDoc schema (done) | 2-3 weeks | Suggest endpoint + review UI |
| **2** | Behavioral Baseline Learning | Receipt stream + real integration | Build infra now; useful after OpenClaw | Proxy-side statistics module |
| **3** | Anomaly Scoring + Adaptive Response | Stage 2 baselines with warm-up | Directly after Stage 2 | Scoring engine + graduated response |
| **4** | Aggregate Blast Radius | Capability storage (done) | Parallel with Stages 2-3 | Dashboard + aggregation endpoint |
| **5** | Proof-of-Claim Ground Truth | Stages 2-3 active + PoC protocol | 12-18 months | Protocol integration + trust model |

### First 90 days after Phase 1 ships

1. **NL Engine module:** `proxy/src/nl-engine.ts` — BYOK config, provider abstraction (Anthropic + OpenAI), system prompt, rate limiting. This unblocks Stages 1, 3 (explanations), and 4 (risk narration).
2. **Stage 1:** `POST /capability/suggest` endpoint + extension review UI with conversational refinement
3. **Stage 2 infrastructure:** Baseline data structure, storage, incremental update logic — even if baselines aren't used for scoring yet, start collecting the data
4. **Stage 4 endpoint:** `GET /agent/:pubkey/blast-radius` — pure aggregation of data that already exists, with NL Engine narration

### What to build after real agent volume

4. **Stage 2 activation:** Warm-up complete, baselines active
5. **Stage 3:** Anomaly scoring in enforcement pipeline, graduated response, wallet UI indicators
6. **Stage 4 cross-cap detection:** Requires multi-capability agents to produce meaningful signals

### What to build when Proof-of-Claim is ready

7. **Stage 5:** Attestation feed integration, trust calibration, closed-loop policy refinement

---

## 8) Design Principles (specific to behavioral intelligence)

These extend the core CapNet design principles from CAPNET_CONTEXT.md:

1. **Intelligence advises, enforcement decides.** The behavioral layer never overrides the deterministic policy engine. It can pause or revoke capabilities (which are enforcement actions), but it cannot *allow* something the policy denies.

2. **Explain, don't just score.** Every anomaly flag must include a human-readable explanation. "Score: 0.67" is useless. "This agent typically makes 3-5 purchases per day; it just attempted 23 in 2 hours" is actionable.

3. **Asymmetric trust.** Trust builds slowly and degrades fast. This is deliberate — security systems should be conservative.

4. **No black boxes in the enforcement path.** The anomaly model must be inspectable. Users should be able to see the baseline, the current deviation, the contributing factors, and the thresholds. If they disagree, they can adjust weights and thresholds.

5. **Tighten first, loosen on evidence.** Policy generation and anomaly thresholds should default to conservative. Loosening happens through demonstrated trustworthy behavior, not user impatience.

6. **The receipt stream is sacred.** Every behavioral decision (flag, pause, revoke, threshold adjustment) produces its own receipt. The audit trail must capture not just what the agent did, but what the intelligence layer decided and why.

7. **The LLM is under the hood, not on the stage.** The NL Engine powers CapNet's intelligence, but the user's relationship is with CapNet, not with the LLM. Responses come in CapNet's voice, through CapNet's UI, with CapNet's branding. The user thinks "CapNet understood what I needed."

8. **Agent-agnostic, always.** CapNet never favors, requires, or assumes a specific agent framework. The enforcement boundary works with any agent that makes API calls. CapNet makes every agent safer without picking winners.

9. **LLM compromise ≠ enforcement compromise.** If the NL Engine's underlying LLM is jailbroken, hallucinating, or unavailable, the enforcement boundary continues to hold. Bad advice is tolerable. Bad enforcement is not. The system must degrade gracefully — losing intelligence features while retaining all safety properties.

---

## 9) Risk & Failure Modes

| Risk | Impact | Mitigation |
|------|--------|------------|
| **False positives** — legitimate agent behavior flagged as anomalous | User frustration, agent interrupted | Configurable thresholds, warm-up period, easy re-authorization, "always allow" override per action type |
| **Baseline poisoning** — attacker slowly shifts baseline before attacking | Anomaly detection blind to gradual drift | Drift detection as meta-signal, long-window baselines alongside short-window, trust calibration from PoC |
| **Threshold gaming** — attacker stays just below anomaly thresholds | Actions individually normal but collectively harmful | Cross-capability analysis (Stage 4), cumulative scoring over time windows, not just per-action |
| **NL Engine hallucination** — LLM suggests inappropriate policy constraints | Overly broad or overly narrow policies | Human review requirement (user is approver, not just consumer), reference policy library as anchor, risk annotation, constraint tightening bias in system prompt |
| **NL Engine unavailability** — LLM provider outage or API key exhaustion | Intelligence features degrade | All enforcement, scoring, and receipt functionality works without the NL Engine. Manual templates remain available. Template-based fallback for anomaly explanations |
| **NL Engine prompt injection** — attacker manipulates LLM through crafted agent descriptions | LLM generates overly permissive policies | System prompt constrains output to valid CapDoc schema. Human review before any capability is issued. Proxy validates generated CapDocs against schema regardless of LLM output |
| **Behavioral intelligence as false confidence** — users trust the system and stop paying attention | Reduced human oversight | Dashboard design should highlight uncertainty, not just scores. "The system is 72% confident this baseline is representative" is better than a green checkmark |
| **Users confuse CapNet with the LLM** — "why do I need CapNet if I'm just talking to Claude?" | Brand dilution, value proposition confusion | LLM is never exposed directly. All responses come through CapNet's UI in CapNet's voice. The user interacts with CapNet, not with Claude/GPT. Messaging consistently positions CapNet as the product |
| **Agent framework lock-in perception** — users think CapNet requires a specific agent | Reduced adoption, positioning as a framework feature | Agent-agnostic messaging in all docs. Phase 1 demo with OpenClaw, but explicit callout that any agent works. No framework-specific dependencies in core proxy |

---

## 10) Messaging (extends CAPNET_CONTEXT.md Section 13)

### New phrases for behavioral intelligence

**Use:**
- "Hard boundaries. Smart baselines. Verified outcomes."
- "The system learns what normal looks like — and catches what doesn't"
- "Intelligence advises, enforcement decides"
- "Trust builds slowly, degrades fast — by design"
- "Your agent earns a longer leash through verified performance"

### New phrases for agent-agnostic positioning

**Use:**
- "Agent-agnostic. Use whatever agent you want — we just make it safe."
- "CapNet doesn't replace your agent. It doesn't compete with your agent. It makes your agent governable."
- "Whatever agent you use today, it becomes safer with CapNet. No lock-in, no switching cost, no opinion about your stack."
- "The enforcement proxy doesn't know what agent is behind the requests — and it doesn't need to."

### New phrases for NL Engine / intelligence

**Use:**
- "CapNet understands what you need" (not "Claude understands what you need through CapNet")
- "Describe what your agent should do. CapNet handles the policy."
- "Even if your AI is compromised, CapNet still holds."

**Avoid:**
- "AI-powered security" (too generic, positions as security tool)
- "Machine learning firewall" (violates the firewall distinction)
- "Autonomous enforcement" (implies humans aren't in control)
- "Self-healing policies" (overpromises, sounds like marketing)
- "Powered by Claude" / "Powered by GPT" (makes the LLM the star; CapNet is the product)
- "AI agent platform" (suggests CapNet is an agent framework; it's not)
- "Works best with [specific agent]" (violates agent-agnostic principle)
- "Requires [specific LLM]" (the NL Engine supports multiple providers and an offline mode)

---

*This document should be read alongside [CAPNET_CONTEXT.md](CAPNET_CONTEXT.md) for the core thesis, design principles, and Phase 0 specification.*
