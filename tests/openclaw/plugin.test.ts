/**
 * OpenClaw Plugin — Registration Unit Tests
 *
 * Tests the plugin registration lifecycle via the mock harness.
 * No proxy needed — validates hook registration, status endpoint, and config.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MockOpenClawRuntime } from "./harness.js";
import { register } from "../../openclaw-plugin/src/index.js";

describe("OpenClaw plugin registration", () => {
  let runtime: MockOpenClawRuntime;

  beforeEach(() => {
    runtime = new MockOpenClawRuntime({
      proxyUrl: "http://127.0.0.1:3100",
      agentId: "agent:test-openclaw",
      agentPubkey: "test-pubkey",
      failPolicy: "closed",
    });
  });

  it("registers before_tool_call and after_tool_call hooks", () => {
    register(runtime);

    const beforeHooks = runtime.getHooks("before_tool_call");
    const afterHooks = runtime.getHooks("after_tool_call");

    expect(beforeHooks.length).toBe(1);
    expect(afterHooks.length).toBe(1);
  });

  it("registers before_tool_call with high priority", () => {
    register(runtime);

    const beforeHooks = runtime.getHooks("before_tool_call");
    expect(beforeHooks[0]!.priority).toBe(1000);
  });

  it("registers /capnet/status HTTP route", () => {
    register(runtime);

    const route = runtime.getRoute("/capnet/status");
    expect(route).toBeDefined();
  });

  it("status endpoint returns correct config", () => {
    register(runtime);

    const status = runtime.invokeRoute("/capnet/status") as Record<string, unknown>;
    expect(status.plugin).toBe("capnet");
    expect(status.version).toBe("0.1.0");
    expect(status.proxyUrl).toBe("http://127.0.0.1:3100");
    expect(status.agentId).toBe("agent:test-openclaw");
    expect(status.failPolicy).toBe("closed");
  });

  it("logs activation messages on registration", () => {
    register(runtime);

    const infoLogs = runtime.logs.filter(l => l.level === "info");
    expect(infoLogs.length).toBeGreaterThan(0);

    const activationLog = infoLogs.find(l => l.message.includes("Enforcement active"));
    expect(activationLog).toBeDefined();
  });

  it("logs gating mode: ALL tools when no gatedTools specified", () => {
    register(runtime);

    const gateLog = runtime.logs.find(l => l.message.includes("Gating ALL tools"));
    expect(gateLog).toBeDefined();
  });

  it("logs gating mode: specific tools when gatedTools specified", () => {
    const runtimeSpecific = new MockOpenClawRuntime({
      agentPubkey: "test-pubkey",
      gatedTools: ["exec", "web_fetch"],
    });
    register(runtimeSpecific);

    const gateLog = runtimeSpecific.logs.find(l => l.message.includes("Gating 2 specific tools"));
    expect(gateLog).toBeDefined();
  });

  it("logs exempt tools when specified", () => {
    const runtimeExempt = new MockOpenClawRuntime({
      agentPubkey: "test-pubkey",
      exemptTools: ["web_search"],
    });
    register(runtimeExempt);

    const exemptLog = runtimeExempt.logs.find(l => l.message.includes("Exempt tools"));
    expect(exemptLog).toBeDefined();
  });

  it("before_tool_call returns undefined for non-gated tools", async () => {
    const runtimeGated = new MockOpenClawRuntime({
      agentPubkey: "test-pubkey",
      gatedTools: ["exec"],
      proxyUrl: "http://127.0.0.1:19999", // unreachable
      timeoutMs: 200,
    });
    register(runtimeGated);

    // web_search is not in gatedTools, so it should pass through
    const result = await runtimeGated.triggerBeforeToolCall("web_search", {});
    expect(result).toBeUndefined();
  });

  it("before_tool_call blocks gated tools when proxy unreachable (fail-closed)", async () => {
    const runtimeClosed = new MockOpenClawRuntime({
      agentPubkey: "test-pubkey",
      proxyUrl: "http://127.0.0.1:19999", // unreachable
      failPolicy: "closed",
      timeoutMs: 200,
    });
    register(runtimeClosed);

    const result = await runtimeClosed.triggerBeforeToolCall("exec", { cmd: "rm -rf /" });
    expect(result).toBeDefined();
    expect(result!.blocked).toContain("denied");
  });
});
