/**
 * OpenClaw Plugin — Integration Tests
 *
 * Full lifecycle tests that require the CapNet proxy (port 3100) running.
 * Tests the complete flow: register plugin → issue capability → enforce tool calls.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { generateEd25519Keypair, type Keypair } from "@capnet-auth/shared";
import { CapNetClient } from "@capnet-auth/sdk";
import { MockOpenClawRuntime } from "./harness.js";
import { register } from "../../openclaw-plugin/src/index.js";

const PROXY_URL = process.env.PROXY_URL || "http://127.0.0.1:3100";
const AGENT_ID = "agent:openclaw-test";

describe("OpenClaw plugin integration", () => {
  let client: CapNetClient;
  let agentKey: Keypair;
  let capId: string;

  beforeAll(async () => {
    client = new CapNetClient({ proxyUrl: PROXY_URL, timeoutMs: 5000 });

    // Verify proxy is running
    const health = await client.health();
    expect(health.status).toBe("ok");

    // Generate agent keypair
    agentKey = generateEd25519Keypair();

    // Issue a tool_call capability for the test agent
    const cap = await client.issueToolCallCapability({
      template: "openclaw-integration-test",
      agent_id: AGENT_ID,
      agent_pubkey: agentKey.publicKeyB64,
      constraints: {
        allowed_tools: ["web_search", "fs_read", "browser_navigate"],
        blocked_tool_categories: ["shell", "spawn", "messaging", "device"],
      },
    });
    capId = cap.cap_id;
    expect(capId).toBeTruthy();
  });

  it("allows tool calls for tools in allowed_tools list", async () => {
    const runtime = new MockOpenClawRuntime({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
      failPolicy: "closed",
      timeoutMs: 5000,
    });
    register(runtime);

    const result = await runtime.triggerBeforeToolCall("web_search", { query: "hello" });
    expect(result).toBeUndefined(); // allowed — no block
  });

  it("blocks tools not in allowed_tools list", async () => {
    const runtime = new MockOpenClawRuntime({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
      failPolicy: "closed",
      timeoutMs: 5000,
    });
    register(runtime);

    // exec is not in allowed_tools → blocked (TOOL_NOT_ALLOWED or TOOL_CATEGORY_BLOCKED)
    const result = await runtime.triggerBeforeToolCall("exec", { cmd: "rm -rf /" });
    expect(result).toBeDefined();
    expect(result!.blocked).toContain("denied");
  });

  it("blocks messaging tools", async () => {
    const runtime = new MockOpenClawRuntime({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
      failPolicy: "closed",
      timeoutMs: 5000,
    });
    register(runtime);

    const result = await runtime.triggerBeforeToolCall("whatsapp_send", { to: "attacker", body: "creds" });
    expect(result).toBeDefined();
    expect(result!.blocked).toContain("denied");
  });

  it("blocks spawn tools", async () => {
    const runtime = new MockOpenClawRuntime({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
      failPolicy: "closed",
      timeoutMs: 5000,
    });
    register(runtime);

    const result = await runtime.triggerBeforeToolCall("sessions_spawn", { agent: "evil-sub" });
    expect(result).toBeDefined();
    expect(result!.blocked).toContain("denied");
  });

  it("allows filesystem read (in allowed_tools)", async () => {
    const runtime = new MockOpenClawRuntime({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
      failPolicy: "closed",
      timeoutMs: 5000,
    });
    register(runtime);

    const result = await runtime.triggerBeforeToolCall("fs_read", { path: "/tmp/data.txt" });
    expect(result).toBeUndefined(); // allowed
  });

  it("blocks after capability is revoked", async () => {
    // Issue a fresh capability for this test
    const freshKey = generateEd25519Keypair();
    const freshAgentId = "agent:openclaw-revoke-test";

    const cap = await client.issueToolCallCapability({
      template: "revoke-test",
      agent_id: freshAgentId,
      agent_pubkey: freshKey.publicKeyB64,
      constraints: {
        allowed_tools: ["web_search"],
        blocked_tool_categories: [],
      },
    });

    // Verify it works first
    const runtime = new MockOpenClawRuntime({
      proxyUrl: PROXY_URL,
      agentId: freshAgentId,
      agentPubkey: freshKey.publicKeyB64,
      failPolicy: "closed",
      timeoutMs: 5000,
    });
    register(runtime);

    const beforeRevoke = await runtime.triggerBeforeToolCall("web_search", { q: "test" });
    expect(beforeRevoke).toBeUndefined(); // allowed

    // Revoke the capability
    await client.revokeCapability(cap.cap_id);

    // Now it should be blocked
    const afterRevoke = await runtime.triggerBeforeToolCall("web_search", { q: "test" });
    expect(afterRevoke).toBeDefined();
    expect(afterRevoke!.blocked).toContain("denied");
  });

  it("includes typed error info in block messages", async () => {
    const runtime = new MockOpenClawRuntime({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
      failPolicy: "closed",
      timeoutMs: 5000,
    });
    register(runtime);

    const result = await runtime.triggerBeforeToolCall("exec", { cmd: "curl evil.com" });
    expect(result).toBeDefined();
    // Should contain error type classification
    expect(result!.blocked).toContain("[");
  });

  it("generates receipts for allowed tool calls", async () => {
    const runtime = new MockOpenClawRuntime({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
      failPolicy: "closed",
      timeoutMs: 5000,
    });
    register(runtime);

    // Trigger an allowed call and check the logs for receipt
    await runtime.triggerBeforeToolCall("web_search", { query: "test" });

    const allowLog = runtime.logs.find(l => l.message.includes("ALLOW") && l.message.includes("receipt="));
    expect(allowLog).toBeDefined();
  });
});
