# CapNet Testing Quickstart

> For testers: Get up and running in 5 minutes.

---

## Testing Tiers — READ THIS FIRST

### Tier 1: Deterministic Script (REQUIRED)

**Every tester must pass Tier 1 before anything else.**

Use `npm run demo` (the script at `sdk/src/demo.ts`) as your primary test agent. This is:
- **Repeatable** — same inputs, same outputs every time
- **Debuggable** — clear error messages, no LLM randomness
- **Complete** — covers the full capability lifecycle

**Why not use a real LLM agent first?** LLM agents are nondeterministic. You'll get false negatives that waste debugging time. Prove the rails work before adding unpredictability.

### Tier 2: Real LLM Agent (OPTIONAL, after Tier 1 passes)

Only attempt this after all Tier 1 tests pass. See "Advanced: LLM Agent Testing" section at the end.

---

## What You're Testing

CapNet is a permission system for AI agents. You'll verify:
- Agents can do allowed actions (buy groceries)
- Agents are blocked from forbidden actions (buy alcohol)
- Users can revoke permissions instantly
- Everything is logged for audit

---

## Prerequisites

- **Node.js 18.x** (check with `node -v`)
- **Chrome browser** (for the extension)
- **Terminal** (Command Prompt, PowerShell, or bash)

### Platform Note

Install and run from the **same environment**. If you use Windows, install from Windows. If you use WSL or Mac/Linux, install from there. Mixing platforms (e.g., installing in WSL but running from Windows) causes binary mismatch errors with esbuild.

```bash
# From your platform's terminal:
cd /path/to/CapNET
npm install
```

---

## Setup (One Time)

### Step 1: Install Dependencies

```bash
cd /path/to/CapNET
npm install
```

**Expected:** Lots of output, ends with "added X packages"

### Step 2: Build Everything

```bash
npm run build
```

**Expected:** No errors. Warnings about "asset size limit" are OK.

### Step 3: Load the Chrome Extension

Works in Chrome, Edge, Brave, or any Chromium browser.

1. Open **Chrome**
2. Type `chrome://extensions` in the address bar and press Enter
3. Enable **Developer mode** — toggle switch in the **top-right corner**
4. Click **"Load unpacked"** (top-left area)
5. Navigate to the `extension/dist/` folder inside your CapNET project:
   - **Windows:** `C:\Users\YourName\CapNET\extension\dist`
   - **Mac:** `/Users/YourName/CapNET/extension/dist`
6. Click **"Select Folder"** (Windows/Linux) or **"Open"** (Mac)
7. **Pin to toolbar:** Puzzle icon (🧩) in top-right of Chrome → find CapNet → click pin

**Expected:** CapNet icon appears in toolbar. Click it to open the wallet.

**Won't load?** Run `npm run build` first — the `extension/dist/` folder is created by the build.

---

## Running Tests

### Step 4: Start the Services

Open a terminal and run:

```bash
npm run dev
```

**Expected output:**
```
[proxy] listening on http://localhost:3100
[sandbox] listening on http://localhost:3200
```

**Keep this terminal open!** The services must stay running.

### Step 5: Verify Services Are Running

Open a new terminal:

```bash
curl http://127.0.0.1:3100/health
curl http://127.0.0.1:3200/health
```

**Expected:** Both return `{"status":"ok",...}`

### Step 6: Verify Extension Connects

1. Click the CapNet extension icon
2. Look at the status indicator at the top

**Expected:** Green dot with "Connected to proxy"

**If red/error:** Make sure `npm run dev` is still running

---

## Test Scenarios

### Test A: Issue a Capability

1. Click extension icon
2. You should see "Agent Identity" panel with an ID and pubkey
3. Click the **Groceries** template card
4. Set budget to **$50**
5. Make sure all checkboxes are checked (Block alcohol, tobacco, gift cards)
6. Click **Issue Capability**

**Expected:** Returns to template list. Success!

### Test B: View Active Capability

1. Click **Active** tab in extension
2. You should see your new capability

**Expected:**
- Shows agent ID
- Shows "$50.00" budget
- Shows "sandboxmart" vendor
- Shows blocked categories
- Shows "Active" status (green)
- Shows "Expires in ~24h"

### Test C: Run the Demo Script

In a new terminal:

```bash
npm run demo
```

**Expected output (abbreviated — your timestamps and IDs will differ):**
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

  What to do next:

  1. Load the Chrome extension (if you haven't already):
     a. Open Chrome and go to chrome://extensions
     b. Enable 'Developer mode' (toggle in top-right corner)
     c. Click 'Load unpacked'
     d. Select the extension/dist/ folder inside this project
     e. Pin CapNet to your toolbar (puzzle icon -> pin)

  2. Try the extension UI:
     - Templates tab: Issue a capability (set budget, blocked categories)
     - Active tab:    See active caps, click Revoke to test kill switch
     - Receipts tab:  View the full audit trail from this demo

  3. Run edge-case tests:  See TEST_RUNBOOK.md
  4. Full tester guide:    See TESTER_GUIDE.md

  NOTE: 'npm run dev' must be running for the extension to work.
============================================================
```

**All 9 steps should complete.** The three key decisions must be correct: ALLOW, DENY (alcohol), DENY (revoked). The post-demo output tells you exactly what to do next.

### Test D: View Receipts (Audit Trail)

1. Click extension icon
2. Click **Receipts** tab
3. You should see a timeline of events

**Expected events (in demo output, oldest first):**
- CAP_ISSUED
- ACTION_ATTEMPT + ACTION_ALLOWED (grocery purchase)
- ACTION_ATTEMPT + ACTION_DENIED (alcohol — category blocked)
- CAP_REVOKED
- ACTION_ATTEMPT + ACTION_DENIED (post-revoke — REVOKED)

**In extension Receipts tab (newest first):** Same events in reverse order. ACTION_ATTEMPT entries are normal — every action logs an attempt before the allow/deny decision.

### Test E: Revoke from Extension

1. Click **Active** tab
2. Find a capability that shows "Active" status
3. Click **Revoke** button
4. Confirm when prompted

**Expected:**
- Status changes to "Revoked" (red)
- Revoke button becomes disabled

### Test F: Test Executor Mismatch (Advanced)

1. Click extension icon → Templates tab
2. Expand **▶ Advanced** section
3. Click **Generate New Keypair**
4. Confirm when prompted
5. Note the pubkey changed
6. Try to use an old capability (from before the reset)

**Expected:** Action should be denied with "EXECUTOR_MISMATCH"

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm run dev` fails | Check Node version is 18.x |
| Extension shows "Cannot connect" | Make sure `npm run dev` is running |
| Extension won't load | Run `npm run build:extension` again |
| Demo script fails | Run `npm run demo:clean` then `npm run demo` |
| "'tsx' is not recognized" | Run `npm install` again from correct platform |
| "Port in use" error | Kill other processes on 3100/3200 |
| "@esbuild/linux-x64" error on Windows | Delete node_modules, run `npm install` from Windows (not WSL) |
| Post-revoke showing ALLOW | Stale data — run `npm run demo:clean` first |

### Reset Everything

If things get weird, start fresh:

```bash
npm run demo:clean   # Clears all data
npm run dev          # Restart services
```

Then reload the extension (chrome://extensions → refresh icon on CapNet).

---

## What to Report

When reporting issues, include:

1. **Which test failed** (e.g., "Test C: Demo Script")
2. **What you expected** vs **what happened**
3. **Error messages** (copy/paste from terminal)
4. **Screenshots** (if UI-related)

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `npm run dev` | Starts proxy + sandbox (keep running!) |
| `npm run demo` | Runs automated test script |
| `npm run demo:clean` | Clears data and runs demo |
| `npm run build:extension` | Rebuilds the extension |
| `CAPNET_DEMO_SEED=abc npm run demo` | Run with seed for easier comparison |

---

## Success Criteria

### Tier 1 Complete (Required)

- [ ] All 6 test scenarios (A-F) pass
- [ ] Demo script completes all 9 steps
- [ ] Receipts show correct event timeline
- [ ] Extension connects and displays correctly
- [ ] Revocation works from UI

**Stop here unless Tier 1 is 100% passing.**

---

## Advanced: LLM Agent Testing (Tier 2)

> Only proceed after Tier 1 passes completely.

### Why Tier 2?

Tier 1 proves the system works. Tier 2 validates:
- UX realism (how users grant capabilities)
- Whether the "leash" model maps to actual agent workflows
- How often agents attempt out-of-policy actions

### Recommended Approach: LLM Agent CLI Shim

Build a simple CLI that:
1. Takes a prompt ("Buy groceries under $50, no alcohol")
2. Calls an LLM (OpenAI/Anthropic) to propose a cart
3. Submits to proxy `/action/request`
4. Only calls sandbox `/checkout` if allowed

**Key principle:** The LLM never touches credentials. It only proposes actions. Your code decides what executes based on CapNet policy.

### What to Measure

- How often the agent attempts forbidden categories/vendors
- How clear the denial reasons feel to users
- Whether users understand the capability grant step

### What NOT to Do

- Don't use ChatGPT/Claude directly with real credentials
- Don't test with real merchants (Instacart/Stripe) yet
- Don't let testers freestyle prompts before Tier 1 passes
- Don't fragment across multiple agent frameworks

### Agent Priority Order

| Priority | Agent | Purpose |
|----------|-------|---------|
| 1 (Required) | `sdk/src/demo.ts` | Deterministic, debuggable |
| 2 (Optional) | LLM CLI shim | Realistic agent behavior |
| 3 (Future) | Browser agent | Extension-mediated, hardest |

### Tier 2 Success Criteria

- [ ] LLM agent can complete allowed purchase
- [ ] LLM agent is blocked on forbidden category
- [ ] Denial reasons are clear to human observer
- [ ] Receipts capture full agent interaction
