# Contributing to CapNet

Thanks for your interest in CapNet! This guide will get you oriented.

## Quick Setup

```bash
git clone https://github.com/Connerlevi/CapNET.git
cd CapNET
npm install
npm run build
npm run dev          # Starts proxy (3100) + sandbox (3200)
```

## Testing

```bash
# Unit tests only (no proxy needed)
npm run test:unit

# All tests (start proxy + sandbox first with `npm run dev`)
npm test

# Watch mode
npm run test:watch

# Typecheck all workspaces
npm run typecheck
```

## Project Structure

| Workspace | Purpose |
|-----------|---------|
| `shared/` | Zod schemas, Ed25519 crypto, types |
| `proxy/` | Enforcement boundary (Express, port 3100) |
| `sandbox/` | Merchant simulator (Express, port 3200) |
| `sdk/` | Client library + demo scenarios |
| `extension/` | Chrome MV3 extension (React) |
| `openclaw-plugin/` | OpenClaw enforcement plugin |
| `mcp-gateway/` | MCP policy enforcement gateway |

## Guides for Testers

- **[TESTING_QUICKSTART.md](TESTING_QUICKSTART.md)** — 5-minute setup, run your first test
- **[TESTER_GUIDE.md](TESTER_GUIDE.md)** — Complete tester manual with scenarios
- **[TEST_RUNBOOK.md](TEST_RUNBOOK.md)** — Detailed test procedures

## Key Conventions

- **TypeScript strict mode** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **CapDoc schema uses `.strict()`** — all new fields must be added to the Zod schema
- **Ed25519 signing** with domain separation prefix `capnet:capdoc/0.1:`
- **Environment variables** — all optional, defaults work for local dev (see `.env.example`)

## Running Demos

```bash
npm run demo          # Core lifecycle demo
npm run demo:all      # All 6 scenarios
npm run demo:runaway  # Runaway agent
npm run demo:hijack   # Agent hijack defense
npm run demo:company  # Multi-agent isolation
npm run demo:openclaw # OpenClaw hijack
npm run demo:github   # GitHub MCP rogue agent
npm run demo:slack    # Slack MCP chatty agent
```

## Reporting Issues

Open an issue on GitHub with:
1. Steps to reproduce
2. Expected vs actual behavior
3. Node version (`node -v`) and OS
