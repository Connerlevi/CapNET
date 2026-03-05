# CapNet Development Alignment Document

## Vision, Demonstration Strategy, and Next Development Phases

**Version:** Internal Alignment Draft\
**Author:** Levi Conner\
**Purpose:** Align development efforts toward a clear CapNet
demonstration and roadmap

------------------------------------------------------------------------

# 1. CapNet Core Vision

CapNet is a **capability-based authorization fabric for autonomous
systems**.

Modern AI agents can:

-   reason
-   plan
-   write code
-   interact with software systems
-   execute real-world actions

However, they currently operate using **traditional credential models**:

-   API keys
-   OAuth tokens
-   service accounts
-   logged-in browser sessions

These mechanisms grant **broad, uncontrolled authority**.

Once an agent possesses credentials, it can typically:

-   read any accessible data
-   modify systems
-   execute transactions
-   perform destructive operations

This creates unacceptable risk for autonomous operation.

------------------------------------------------------------------------

# CapNet Solution

CapNet replaces credential-based authority with **cryptographically
issued capabilities**.

Capabilities define:

-   permitted action types
-   resource scope
-   spending limits
-   vendor allowlists
-   expiration times
-   executor bindings

Instead of giving agents **access**, CapNet gives agents **specific
permission**.

    Agent → Capability → Authorized Action

CapNet acts as the **authority checkpoint** between agents and external
systems.

------------------------------------------------------------------------

# 2. CapNet Architectural Model

CapNet is structured around a **policy enforcement boundary**.

Core architecture:

    Agent
      ↓
    CapNet Enforcement Proxy
      ↓
    External System

The proxy enforces:

-   capability validation
-   scope restrictions
-   policy compliance
-   execution auditing

Capabilities are cryptographically signed and verifiable.

Every executed action produces a **receipt** that records:

-   capability used
-   executor identity
-   timestamp
-   resulting action

This creates a verifiable audit trail.

------------------------------------------------------------------------

# 3. The Problem CapNet Solves

AI agents today operate using **credential-based authority**.

Example architecture:

    Agent → API Key → System

Problems with this model:

-   no fine-grained control
-   no contextual restrictions
-   no automatic containment
-   high blast radius if compromised

Examples of potential failures:

-   agent deletes production infrastructure
-   agent spends excessive funds
-   prompt injection triggers malicious behavior
-   compromised agent escalates privileges

CapNet solves this by replacing **credentials with capabilities**.

------------------------------------------------------------------------

# 4. Demonstration Strategy

To communicate CapNet effectively to engineers, investors, and
developers, we must demonstrate the **failure of credential-based
agents** and the **safety of capability-based agents**.

Three demonstration scenarios are recommended.

------------------------------------------------------------------------

# Demo 1: Runaway Agent

**Purpose:** Demonstrate that credential-based agents are unsafe.

Scenario:

An AI agent is tasked with:

> "Clean up unused resources."

The agent possesses standard credentials.

Without CapNet, the agent performs unintended destructive actions.

Example:

    delete production database
    terminate compute resources
    modify repositories

When routed through CapNet, these actions are evaluated against
capabilities.

Example outcome:

    ACTION: delete database
    DENIED: resource outside capability scope

    ACTION: close GitHub issue
    ALLOWED

    ACTION: terminate EC2 instance
    DENIED: requires elevated capability

Key insight demonstrated:

Agents cannot safely operate with unrestricted credentials.

------------------------------------------------------------------------

# Demo 2: Agent Hijack

**Purpose:** Demonstrate containment of compromised agents.

Scenario:

An AI shopping assistant is compromised through prompt injection.

Malicious instruction:

> "Purchase 100 gift cards."

Without CapNet:

The agent executes the purchase.

Result:

    $10,000 unauthorized purchase

With CapNet:

    ACTION: purchase gift cards
    DENIED: category blocked

Key insight demonstrated:

CapNet **limits blast radius even when agents are compromised**.

------------------------------------------------------------------------

# Demo 3: Multi-Agent Company

**Purpose:** Demonstrate CapNet as the governance layer for AI-driven
organizations.

Scenario:

A company deploys multiple AI agents.

Example roles:

    Sales Agent
    Finance Agent
    Engineering Agent
    Operations Agent

Without CapNet:

Each agent must be given credentials.

This creates systemic risk.

With CapNet:

Each agent receives scoped capabilities.

Example:

Sales Agent

    create CRM leads
    send proposals
    cannot issue refunds

Finance Agent

    issue refunds
    manage invoices
    cannot deploy code

Engineering Agent

    deploy staging environments
    cannot access financial systems

Key insight demonstrated:

CapNet enables **safe large-scale agent deployment**.

------------------------------------------------------------------------

# 5. CapNet Strategic Position

CapNet operates as the **authority layer for the agentic internet**.

Future architecture:

    AI Agents
       ↓
    CapNet Authority Layer
       ↓
    External Tools and Services

Examples:

    Agents → CapNet → Stripe
    Agents → CapNet → GitHub
    Agents → CapNet → Slack
    Agents → CapNet → AWS

CapNet determines **what agents are allowed to do**.

------------------------------------------------------------------------

# 6. Immediate Development Priorities

To advance CapNet beyond concept, the following development phases
should be prioritized.

------------------------------------------------------------------------

# Phase 1: Developer SDK

Developers must be able to integrate CapNet in minutes.

Target experience:

    import { CapNet } from "capnet"

    agent.useCapNet({
      action: "spend",
      maxAmount: 100,
      vendors: ["amazon"],
      expires: "24h"
    })

Goals:

-   minimal integration friction
-   clear capability definitions
-   intuitive developer workflow

Developer experience will determine adoption.

------------------------------------------------------------------------

# Phase 2: First Real Integration

CapNet must demonstrate real-world interoperability.

Initial targets:

-   OpenClaw agents
-   GitHub
-   Stripe
-   Slack

The OpenClaw integration is particularly strategic because it addresses
**known agent security concerns**.

Narrative:

> "OpenClaw is powerful but unsafe. CapNet makes it safe."

------------------------------------------------------------------------

# Phase 3: Delegation System

Implement hierarchical authority.

Example structure:

    Human Operator
      ↓
    AI Manager Agent
      ↓
    Worker Agents

Each layer can delegate limited capabilities.

This allows complex multi-agent systems to operate safely.

------------------------------------------------------------------------

# Phase 4: MCP Security Gateway

Model Context Protocol (MCP) is emerging as the standard interface for
agent tool access.

CapNet can act as a **policy enforcement gateway for MCP tools**.

Architecture:

    Agent
      ↓
    MCP Tool Request
      ↓
    CapNet Gateway
      ↓
    Authorized Tool Execution

If implemented early, CapNet could become the **default security layer
for MCP ecosystems**.

------------------------------------------------------------------------

# Phase 5: Expanded Integrations

Once the core system is stable, additional integrations should be
developed.

Priority targets:

-   AWS
-   Google Workspace
-   Notion
-   GitHub Actions
-   payment processors

The goal is to position CapNet as a **universal authority layer for AI
systems**.

------------------------------------------------------------------------

# 7. Long-Term Vision

If successful, CapNet becomes foundational infrastructure for AI
systems.

Future architecture:

    AI Agent
       ↓
    CapNet
       ↓
    Tools / APIs / Services

This model replaces credential-based control with capability-based
governance.

In effect, CapNet becomes:

**the authority layer for machine actors.**

------------------------------------------------------------------------

# 8. Success Criteria

CapNet should aim to achieve:

-   simple developer onboarding
-   clear safety benefits
-   strong integration ecosystem
-   compatibility with emerging agent frameworks

Success will be measured by whether developers begin designing agents
using **capabilities rather than credentials**.

------------------------------------------------------------------------

# Closing Statement

The rise of autonomous systems introduces a new problem:

Machines must be given authority without granting unrestricted power.

CapNet provides a structured solution.

By issuing cryptographically scoped capabilities and enforcing them
through a policy proxy, CapNet enables safe, auditable, and controlled
operation of autonomous agents.

This system may form a foundational layer for the **next generation of
internet infrastructure built around machine actors.**
