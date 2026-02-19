# CapNet Tester Guide

> Complete guide for third-party testers. Read this before you start.

---

## Table of Contents

1. [What You're Testing](#what-youre-testing)
2. [Why This Matters](#why-this-matters)
3. [Setup (15 minutes)](#setup-15-minutes)
4. [Your First Test Run](#your-first-test-run)
5. [What You Can Modify](#what-you-can-modify)
6. [Test Scenarios](#test-scenarios)
7. [Exploratory Testing](#exploratory-testing)
8. [What NOT to Do](#what-not-to-do)
9. [Reporting Issues](#reporting-issues)
10. [FAQ](#faq)

---

## What You're Testing

CapNet is a **permission system for AI agents**. Think of it as a leash for autonomous software.

### The Problem We Solve

Today, if you want an AI agent to do something useful (buy groceries, send emails, book flights), you have to give it your credentials — passwords, API keys, credit card numbers. That's like giving your house keys to a stranger and hoping they only use the bathroom.

### Our Solution

CapNet creates **bounded, revocable permissions** called "capabilities." Instead of giving an agent your credit card, you give it a capability that says:

- "You can spend up to $50"
- "Only at these stores"
- "Not on alcohol or tobacco"
- "This permission expires in 24 hours"
- "I can revoke this instantly if something goes wrong"

### What You're Validating

1. **Allowed actions work** — Agent can do what it's permitted to do
2. **Forbidden actions are blocked** — Agent cannot exceed its bounds
3. **Revocation is instant** — User can kill permissions immediately
4. **Audit trail is complete** — Every action is logged with reasons

---

## Why This Matters

### For Users
- Control AI agents without trusting them completely
- Know exactly what an agent did and why
- Stop bad behavior instantly

### For Developers
- Build AI integrations without liability nightmares
- Prove compliance with audit trails
- Standardize on a permission model

### For the Industry
- This could become how all AI agents request permissions
- Like OAuth, but for actions instead of identity

**Your testing helps validate that this model works before we put it in front of real users and investors.**

---

## Setup (15 minutes)

### Prerequisites

| Requirement | How to Check | Install If Missing |
|-------------|--------------|-------------------|
| Node.js 18.x | `node -v` → should show v18.x.x | [nodejs.org](https://nodejs.org) |
| Chrome browser | Open Chrome | [google.com/chrome](https://google.com/chrome) |
| Git (optional) | `git --version` | [git-scm.com](https://git-scm.com) |

### Step 1: Get the Code

You should have received the project files. Extract them to a folder you can find.

```
C:\Users\YourName\CapNET\   (Windows)
~/CapNET/                    (Mac/Linux)
```

### Step 2: Install Dependencies

Open a terminal in the project folder and install. **Important:** Install and run from the **same environment** — if you use Windows, install from Windows. If you use WSL or Mac/Linux, install from there. Mixing platforms causes binary mismatch errors.

```bash
cd /path/to/CapNET
npm install
```

**Expected:** Lots of output, ends with "added X packages"

**If you get errors:**
| Error | Solution |
|-------|----------|
| `npm: command not found` | Install Node.js |
| `EACCES permission denied` | Don't use `sudo`, fix npm permissions |
| `@esbuild` platform error | Delete `node_modules`, reinstall from the same platform you'll run from |

### Step 3: Build the Extension

```bash
npm run build
```

**Expected:** No errors. Warnings about "asset size limit" are OK.

### Step 4: Load the Chrome Extension

1. Open Chrome
2. Go to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Navigate to the `extension/dist` folder inside the project
6. Click **Select Folder**
7. Pin the CapNet extension to your toolbar (puzzle icon → pin)

**Expected:** CapNet icon appears in your toolbar

### Step 5: Start the Services

```bash
npm run dev
```

**Expected output:**
```
[proxy] CapNet Proxy listening on http://localhost:3100
[sandbox] CapNet Sandbox listening on http://localhost:3200
```

**Keep this terminal open!** The services must stay running while you test.

### Step 6: Verify Everything Works

1. Click the CapNet extension icon
2. You should see "Connected to proxy" with a green indicator
3. You should see an "Agent Identity" panel with an ID and pubkey

**If you see errors:** Check that `npm run dev` is still running.

---

## Your First Test Run

### The Automated Demo (2 minutes)

Open a NEW terminal (keep the services running in the first one):

```bash
npm run demo:clean
```

This clears old data and runs a complete test cycle. You should see:

```
============================================================
CapNet Demo Agent — Capability Lifecycle
============================================================

[1] Loading agent identity...
    Agent ID: agent:demo-grocerybot
    Pubkey: abc123...

[2] Checking services...
    Proxy: ok
    Sandbox: ok

[3] Wallet issuing capability to agent...
    Cap ID: cap_...
    Budget: $50.00
    Blocked: alcohol, tobacco, gift_cards

[4] Fetching merchant catalog...
    Vendor: sandboxmart
    Items: 16

[5] Building grocery cart (should be ALLOWED)...
    Cart:
      - Organic Milk (1 gal) ($5.99)
      - Whole Wheat Bread ($3.49)
      - Free Range Eggs (12) ($4.99)
    Total: $14.47
    Decision: ALLOW              ← CORRECT

[6] Attempting to buy alcohol (should be DENIED)...
    Cart: Red Wine (750ml) ($14.99)
    Decision: DENY               ← CORRECT
    Reason: CATEGORY_BLOCKED:alcohol

[7] Revoking capability...
    Revoked: cap_...

[8] Attempting groceries after revoke (should be DENIED)...
    Decision: DENY               ← CORRECT
    Reason: REVOKED

[9] Audit trail (last 10 receipts, oldest first)...
    CAP_ISSUED ($50.00)
    ACTION_ATTEMPT ($14.47)
    ACTION_ALLOWED ($14.47)
    ACTION_ATTEMPT ($14.99)
    ACTION_DENIED (CATEGORY_BLOCKED:alcohol)
    CAP_REVOKED
    ACTION_ATTEMPT ($14.47)
    ACTION_DENIED (REVOKED)

============================================================
Demo Summary
============================================================
  ✓ Groceries allowed (within budget, allowed vendor)
  ✗ Alcohol denied (blocked category)
  ✗ Post-revoke denied (capability revoked)

The leash works. Agents can act, but only within bounds.
============================================================
```

### What Just Happened?

1. **Agent got a permission** — Limited to $50, groceries only, specific store
2. **Agent made a valid purchase** — Within bounds, so it worked
3. **Agent tried to buy wine** — Blocked because alcohol is forbidden
4. **User revoked the permission** — Instantly
5. **Agent tried again** — Blocked because permission no longer exists
6. **Everything was logged** — Full audit trail

**If all 3 key decisions are correct (ALLOW, DENY alcohol, DENY revoked), the core system works.**

---

## What You Can Modify

### YES — Please Experiment With These

#### 1. Budget Limits

In the extension, when issuing a capability:
- Try $5 budget, then attempt a $10 purchase → should be DENIED
- Try $1000 budget → should allow larger purchases

#### 2. Blocked Categories

Uncheck "Block alcohol" and try to buy wine → should now be ALLOWED

#### 3. Vendor Restrictions

The current capability only allows "sandboxmart". Try:
- Modifying `proxy/src/index.ts` to add another vendor
- See if the agent can use capabilities across vendors

#### 4. Time Limits

Capabilities expire after 24 hours. To test expiration faster:
- Issue a capability
- Edit `data/caps.json` directly
- Change `expires_at` to a past timestamp
- Try an action → should be DENIED with `CAP_EXPIRED`

#### 5. Agent Identity

In the extension:
- Click "Advanced" → "Generate New Keypair"
- Try using an old capability → should be DENIED with `EXECUTOR_MISMATCH`
- This proves capabilities are bound to specific agents

#### 6. Cart Contents

Modify what the demo script tries to buy:
- Edit `sdk/src/demo.ts`
- Change the cart items (SKUs are in the catalog)
- See how different purchases are handled

#### 7. Multiple Capabilities

- Issue several capabilities with different constraints
- See how the system handles overlapping permissions
- Revoke one, verify others still work

### Data Files You Can Inspect/Modify

| File | What It Contains | Safe to Modify? |
|------|------------------|-----------------|
| `data/caps.json` | All issued capabilities | Yes — experiment freely |
| `data/receipts.jsonl` | Audit log (one JSON per line) | Yes — delete to clear history |
| `data/revoked.json` | List of revoked cap IDs | Yes — remove to "un-revoke" |
| `data/issuer_keys.json` | Proxy's signing keypair | Careful — delete = new identity |
| `data/demo_agent_key.json` | Demo agent's keypair | Careful — delete = new agent |

### Reset Everything

If you break something or want a clean slate:

```bash
npm run demo:clean
```

This deletes all data files and runs the demo fresh.

---

## Test Scenarios

### Tier 1: Core Functionality (REQUIRED)

Every tester must verify these pass. Use `npm run demo` or manual testing.

| # | Scenario | How to Test | Expected Result |
|---|----------|-------------|-----------------|
| 1 | Health check | `curl http://127.0.0.1:3100/health` | `{"status":"ok",...}` |
| 2 | Issue capability | Extension → Templates → Groceries → Issue | Cap appears in Active tab |
| 3 | Allowed purchase | Demo step 5 or manual grocery cart | Decision: ALLOW |
| 4 | Category block | Demo step 6 or add alcohol to cart | Decision: DENY, CATEGORY_BLOCKED |
| 5 | Budget exceeded | Issue $10 cap, try $20 purchase | Decision: DENY, AMOUNT_EXCEEDS_MAX |
| 6 | Revocation | Active tab → Revoke button | Status changes to "Revoked" |
| 7 | Post-revoke denial | Try action after revoke | Decision: DENY, reason: REVOKED |
| 8 | Audit trail | Receipts tab | Shows all events with timestamps (including ACTION_ATTEMPT entries) |

### Tier 2: Edge Cases (RECOMMENDED)

| # | Scenario | How to Test | Expected Result |
|---|----------|-------------|-----------------|
| 9 | Wrong vendor | Modify request to use "other-store" | Decision: DENY, VENDOR_NOT_ALLOWED |
| 10 | Expired capability | Edit `expires_at` to past time | Decision: DENY, CAP_EXPIRED |
| 11 | Executor mismatch | Generate new keypair, use old cap | Decision: DENY, EXECUTOR_MISMATCH |
| 12 | Invalid signature | Corrupt `proof.sig` in caps.json | Decision: DENY, BAD_SIGNATURE |
| 13 | Persistence | Restart proxy, check caps still exist | Capabilities survive restart |
| 14 | Revocation persists | Restart proxy, revoked cap still denied | Revocation survives restart |

### Tier 3: Stress & Chaos (OPTIONAL)

| # | Scenario | How to Test | What to Observe |
|---|----------|-------------|-----------------|
| 15 | Rapid requests | Loop 100 action requests | No crashes, correct decisions |
| 16 | Large cart | 50+ items in one cart | Budget calculated correctly |
| 17 | Concurrent caps | Issue 10 caps, use randomly | Each cap tracked independently |
| 18 | Kill mid-request | Stop proxy during action | Client handles timeout gracefully |
| 19 | Corrupt data | Mangle caps.json, restart | Proxy handles gracefully or rejects |

---

## Exploratory Testing

Beyond the scripted scenarios, we encourage you to try breaking things creatively.

### Questions to Explore

1. **Can you bypass the proxy?**
   - What if an agent calls the sandbox directly?
   - (Hint: In production, the sandbox would require proxy approval)

2. **Can you forge a capability?**
   - Try creating a cap with a fake signature
   - Does the proxy accept it?

3. **Can you replay old requests?**
   - Save an allowed action request
   - Try submitting it again after revocation

4. **What happens with weird inputs?**
   - Negative budget?
   - Empty cart?
   - Future `not_before` date?
   - Malformed JSON?

5. **What's missing?**
   - What would you need to use this in production?
   - What's confusing or unclear?

### Report What You Find

Even "this is weird but not broken" observations are valuable. See [Reporting Issues](#reporting-issues).

---

## What NOT to Do

### Don't

- **Don't test with real credentials** — This is a sandbox, not production
- **Don't run on production systems** — Local development only
- **Don't share the code publicly** — Pre-release, NDA applies
- **Don't test over public networks** — Localhost only for now
- **Don't expect perfect UX** — This is Phase 0, functionality over polish

### Don't Worry About

- **Bundle size warnings** — Known, acceptable for demo
- **Missing features** — Delegation/attenuation not implemented yet
- **Single agent limit** — Multi-agent is future work
- **Local-only proxy** — Remote proxy is future work

---

## Reporting Issues

### What to Report

1. **Bugs** — Something doesn't work as expected
2. **Unexpected behavior** — Works but seems wrong
3. **Confusion** — Documentation unclear or missing
4. **Suggestions** — "It would be better if..."
5. **Security concerns** — Bypasses, leaks, weaknesses

### How to Report

Create a report with:

```
## Issue Title
One sentence summary

## Steps to Reproduce
1. Start from clean state: `npm run demo:clean`
2. Do X
3. Do Y
4. Observe Z

## Expected Behavior
What should have happened

## Actual Behavior
What actually happened

## Evidence
- Terminal output (copy/paste)
- Screenshots (for extension issues)
- Contents of data/*.json if relevant

## Environment
- OS: Windows 11 / macOS 14 / Ubuntu 22
- Node version: (run `node -v`)
- Browser: Chrome 120

## Severity
- Critical: Blocks all testing
- High: Major feature broken
- Medium: Works but wrong
- Low: Minor issue or suggestion
```

### Where to Submit

Send your report to the project lead who gave you access to the code. Include "CapNet Testing" in the subject line. For security issues, add "[Security]" to the subject.

---

## FAQ

### Setup Issues

**Q: `npm run dev` says port in use**
A: Something else is using port 3100 or 3200. Find and kill it:
```bash
# Windows
netstat -ano | findstr :3100
taskkill /PID <pid> /F

# Mac/Linux
lsof -i :3100
kill -9 <pid>
```

**Q: Extension shows "Cannot connect to proxy"**
A: Make sure `npm run dev` is running. Check the terminal for errors.

**Q: `npm install` fails with permission errors**
A: Don't use `sudo`. Fix npm permissions or use nvm.

**Q: Demo shows ALLOW for something that should be DENIED**
A: Probably stale data. Run `npm run demo:clean` for a fresh start.

### Understanding the System

**Q: What's the difference between proxy and sandbox?**
A:
- **Proxy (port 3100)** = The enforcement boundary. Checks permissions, logs everything.
- **Sandbox (port 3200)** = Fake merchant. Simulates a store with products.

**Q: Where do capabilities come from?**
A: The proxy creates them when you click "Issue Capability" in the extension. They're signed with the proxy's private key.

**Q: How does the agent prove it has permission?**
A: The capability contains the agent's public key. When the agent makes a request, it includes this key. The proxy verifies the capability is bound to that agent.

**Q: What's the difference between a capability and a receipt?**
A:
- **Capability** = Permission to act (before the action)
- **Receipt** = Record of what happened (after the action)

**Q: Why is there no login/password?**
A: CapNet is about authorization (what can you do), not authentication (who are you). In production, it would integrate with existing identity systems.

### Testing Philosophy

**Q: Should I try to break things?**
A: Yes! Finding bugs now is valuable. Just document what you did.

**Q: What if I find a security hole?**
A: Report it immediately with [Security] in the subject. Don't share publicly.

**Q: How thorough should I be?**
A: At minimum, complete all Tier 1 scenarios. Tier 2 and 3 are bonus but appreciated.

**Q: Can I automate tests?**
A: Yes, but manual testing finds different bugs. Do both if you can.

---

## Quick Reference

### Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies (once) |
| `npm run dev` | Start proxy + sandbox (keep running) |
| `npm run demo` | Run automated test script |
| `npm run demo:clean` | Clear data and run demo |
| `npm run build` | Rebuild shared + extension |
| `npm run build:extension` | Rebuild extension only |

### URLs

| URL | What It Is |
|-----|------------|
| `http://127.0.0.1:3100` | Proxy (enforcement) |
| `http://127.0.0.1:3200` | Sandbox (merchant) |
| `http://127.0.0.1:3100/health` | Proxy health check |
| `http://127.0.0.1:3200/health` | Sandbox health check |
| `http://127.0.0.1:3100/capabilities` | List all capabilities |
| `http://127.0.0.1:3100/receipts` | View audit log |
| `http://127.0.0.1:3200/catalog` | View product catalog |

### Key Files

| File | Purpose |
|------|---------|
| `data/caps.json` | Stored capabilities |
| `data/receipts.jsonl` | Audit log |
| `data/revoked.json` | Revoked cap IDs |
| `sdk/src/demo.ts` | Demo script source |
| `extension/dist/` | Built extension (load in Chrome) |

### Success Criteria

The system is working correctly if:

- [ ] `npm run demo` completes with all correct decisions
- [ ] Extension connects and shows capabilities
- [ ] Allowed actions succeed
- [ ] Blocked categories are denied
- [ ] Budget limits are enforced
- [ ] Revocation is immediate
- [ ] Receipts show complete history

---

## Thank You

Your testing helps ensure CapNet is ready for the real world. Every bug you find, every confusing moment you report, every suggestion you make — it all matters.

**The leash works. Help us prove it.**
