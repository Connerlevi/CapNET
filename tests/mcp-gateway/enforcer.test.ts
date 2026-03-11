/**
 * MCP Gateway — Enforcer Unit Tests
 *
 * Tests the GatewayEnforcer in isolation (no proxy needed).
 * Validates fail policy behavior and tool category classification.
 */

import { describe, it, expect } from "vitest";
import { GatewayEnforcer } from "../../mcp-gateway/src/enforcer.js";

describe("GatewayEnforcer", () => {
  it("denies on proxy failure with fail-closed (default)", async () => {
    const enforcer = new GatewayEnforcer({
      proxyUrl: "http://127.0.0.1:19999", // unreachable
      agentPubkey: "fakepub",
      failPolicy: "closed",
      timeoutMs: 200,
    });

    const result = await enforcer.enforce("read_file", { path: "/tmp/test" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("PROXY_UNREACHABLE");
    expect(result.errorType).toBe("CapNetError");
  });

  it("allows on proxy failure with fail-open", async () => {
    const enforcer = new GatewayEnforcer({
      proxyUrl: "http://127.0.0.1:19999", // unreachable
      agentPubkey: "fakepub",
      failPolicy: "open",
      timeoutMs: 200,
    });

    const result = await enforcer.enforce("read_file", { path: "/tmp/test" });
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("PROXY_UNREACHABLE (fail-open)");
  });

  it("uses provided tool category over auto-classification", async () => {
    const enforcer = new GatewayEnforcer({
      proxyUrl: "http://127.0.0.1:19999",
      agentPubkey: "fakepub",
      failPolicy: "open",
      timeoutMs: 200,
    });

    // Even though "custom_tool" would classify as "other",
    // explicit category should be used
    const result = await enforcer.enforce("custom_tool", {}, "shell");
    expect(result.allowed).toBe(true); // fail-open
  });

  it("reports latency", async () => {
    const enforcer = new GatewayEnforcer({
      proxyUrl: "http://127.0.0.1:19999",
      agentPubkey: "fakepub",
      failPolicy: "closed",
      timeoutMs: 200,
    });

    const result = await enforcer.enforce("read_file", {});
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("checkProxy returns false for unreachable proxy", async () => {
    const enforcer = new GatewayEnforcer({
      proxyUrl: "http://127.0.0.1:19999",
      agentPubkey: "fakepub",
      timeoutMs: 200,
    });

    const ok = await enforcer.checkProxy();
    expect(ok).toBe(false);
  });
});
