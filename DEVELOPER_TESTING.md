# CapNet — Developer Testing Guide

CapNet is a permission layer for AI agents. Instead of giving agents API keys, users issue scoped capabilities. All actions pass through an enforcement proxy that logs receipts.

You're being asked to kick the tires and tell us what breaks, what's confusing, and whether this is something you'd actually use.

---

## Setup (5 minutes)

```bash
git clone https://github.com/Connerlevi/CapNET.git
cd CapNET
npm install
npm run build
```

Verify it works:

```bash
npm run test:unit     # 77 tests, should all pass
```

Run the full demo:

```bash
npm run dev           # Terminal 1: starts proxy (3100) + sandbox (3200)
npm run demo          # Terminal 2: full capability lifecycle
```

You should see: capability issued, grocery purchase allowed, alcohol denied, capability revoked, post-revoke purchase denied.

---

## What to Test

### 1. Run the demo scenarios (10 minutes)

```bash
npm run demo:all
```

Six scenarios showing real attack prevention — runaway agents, prompt injection, MCP tool abuse. Watch the output. Does the enforcement make sense? Are the denial reasons clear?

### 2. Run the automated tests (2 minutes)

```bash
npm run test:unit                  # Unit tests (no proxy needed)
npm test                           # Full suite (proxy + sandbox must be running)
```

### 3. Try the Chrome extension (10 minutes)

1. Open `chrome://extensions`, enable Developer Mode
2. Click "Load unpacked" → select `extension/dist/`
3. Pin CapNet to your toolbar, click to open
4. Issue a capability from the Templates tab
5. Check Active tab — see the capability
6. Check Receipts tab — see the audit trail
7. Click Revoke — verify it works

### 4. Break things (as long as you want)

This is the most valuable part. Try to:

- Bypass the proxy (call sandbox directly)
- Use a capability after it's revoked
- Forge a capability with a fake signature
- Send malformed JSON to the proxy
- Exceed a budget limit
- Use a capability with the wrong agent identity

---

## What We Want to Know

After testing, we'd love your answers to these questions:

1. **Did setup work on the first try?** If not, what went wrong?
2. **Do the denial reasons make sense?** When an action is blocked, is it obvious why?
3. **Is the capability model intuitive?** Does "issue → use → revoke" feel natural?
4. **Would you use this?** If you have an agent that takes real actions, would you put CapNet in front of it?
5. **What's missing?** What would you need before you'd integrate this into a real project?
6. **What's confusing?** Anything in the docs or output that made you stop and think?

---

## How to Report

Pick whatever is easiest:

- **GitHub Issue** — [github.com/Connerlevi/CapNET/issues](https://github.com/Connerlevi/CapNET/issues)
- **DM or email** — just reply to however you received this

No formal template needed. A few sentences about what you tried and what happened is plenty.

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm run build` | Build everything |
| `npm run dev` | Start proxy + sandbox |
| `npm run test:unit` | Unit tests (no server needed) |
| `npm test` | All tests (servers must be running) |
| `npm run demo` | Core lifecycle demo |
| `npm run demo:all` | All 6 attack scenarios |
| `npm run demo:clean` | Clear data + fresh demo |

**Requires:** Node.js 18+ and Chrome (for extension testing).

**Deeper docs:** [TESTER_GUIDE.md](TESTER_GUIDE.md) has exploratory testing ideas, FAQ, and edge cases if you want to go further.
