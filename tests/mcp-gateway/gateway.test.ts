/**
 * MCP Gateway — Integration Tests
 *
 * Tests the full gateway lifecycle with a real MCP server (filesystem)
 * and the CapNet proxy. Requires proxy running on port 3100.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateEd25519Keypair } from "@capnet/shared";
import { CapNetClient } from "@capnet/sdk";
import { CapNetMcpGateway } from "../../mcp-gateway/src/gateway.js";
import type { GatewayConfig } from "../../mcp-gateway/src/types.js";

const PROXY_URL = process.env.PROXY_URL || "http://127.0.0.1:3100";
const AGENT_ID = "agent:mcp-gateway-test";

describe("CapNet MCP Gateway integration", () => {
  let client: CapNetClient;
  let agentKey: ReturnType<typeof generateEd25519Keypair>;

  beforeAll(async () => {
    client = new CapNetClient({ proxyUrl: PROXY_URL, timeoutMs: 5000 });
    const health = await client.health();
    expect(health.status).toBe("ok");

    agentKey = generateEd25519Keypair();
  });

  it("creates a gateway with correct config", () => {
    const config: GatewayConfig = {
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
    };
    const gateway = new CapNetMcpGateway(config);
    expect(gateway.agentId).toBe(AGENT_ID);
    expect(gateway.agentPubkey).toBe(agentKey.publicKeyB64);
    expect(gateway.tools).toHaveLength(0);
    expect(gateway.upstreamCount).toBe(0);
  });

  it("checks proxy health", async () => {
    const gateway = new CapNetMcpGateway({
      proxyUrl: PROXY_URL,
      agentPubkey: agentKey.publicKeyB64,
    });
    const ok = await gateway.checkProxy();
    expect(ok).toBe(true);
  });

  it("reports proxy unreachable for bad URL", async () => {
    const gateway = new CapNetMcpGateway({
      proxyUrl: "http://127.0.0.1:19999",
      agentPubkey: agentKey.publicKeyB64,
      timeoutMs: 200,
    });
    const ok = await gateway.checkProxy();
    expect(ok).toBe(false);
  });

  it("discovers tools from a filesystem MCP server", async () => {
    const gateway = new CapNetMcpGateway({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
    });

    const tools = await gateway.addUpstream({
      name: "filesystem",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    });

    expect(tools.length).toBeGreaterThan(0);
    expect(gateway.tools.length).toBe(tools.length);
    expect(gateway.upstreamCount).toBe(1);

    // Should have filesystem tools
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain("read_file");
    expect(toolNames).toContain("list_directory");

    // Tools should be classified correctly
    const readFile = tools.find(t => t.name === "read_file");
    expect(readFile?.category).toBe("filesystem");
    expect(readFile?.upstream).toBe("filesystem");

    await gateway.close();
  }, 30000); // npx install can be slow

  it("enforces capability on tool calls via gateway", async () => {
    // Issue a capability that allows only read_file and list_directory
    const cap = await client.issueToolCallCapability({
      template: "mcp-gateway-test",
      agent_id: AGENT_ID,
      agent_pubkey: agentKey.publicKeyB64,
      constraints: {
        allowed_tools: ["read_file", "list_directory"],
        blocked_tool_categories: ["shell"],
      },
    });
    expect(cap.cap_id).toBeTruthy();

    const gateway = new CapNetMcpGateway({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
    });

    const tools = await gateway.addUpstream({
      name: "filesystem",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    });

    expect(tools.length).toBeGreaterThan(0);

    // The gateway enforcer should allow read_file
    const enforcer = new (await import("../../mcp-gateway/src/enforcer.js")).GatewayEnforcer({
      proxyUrl: PROXY_URL,
      agentId: AGENT_ID,
      agentPubkey: agentKey.publicKeyB64,
    });

    const allowResult = await enforcer.enforce("read_file", { path: "/tmp/test" }, "filesystem");
    expect(allowResult.allowed).toBe(true);

    // Should deny write_file (not in allowed_tools)
    const denyResult = await enforcer.enforce("write_file", { path: "/tmp/test", content: "x" }, "filesystem");
    expect(denyResult.allowed).toBe(false);

    await gateway.close();
  }, 30000);
});
