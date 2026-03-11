/**
 * OpenClaw Plugin — Enforcer Unit Tests
 *
 * Tests the CapNetEnforcer class in isolation (no proxy needed).
 * Validates request construction, gating logic, category mapping, and fail policy.
 */

import { describe, it, expect } from "vitest";
import { CapNetEnforcer } from "../../openclaw-plugin/src/enforcer.js";
import { getToolCategory, TOOL_CATEGORY_MAP } from "../../openclaw-plugin/src/types.js";

// ---------------------------------------------------------------------------
// shouldGate() logic
// ---------------------------------------------------------------------------

describe("CapNetEnforcer.shouldGate()", () => {
  it("gates all tools when no gatedTools specified", () => {
    const enforcer = new CapNetEnforcer({
      agentPubkey: "fakepub",
    });
    expect(enforcer.shouldGate("exec")).toBe(true);
    expect(enforcer.shouldGate("web_search")).toBe(true);
    expect(enforcer.shouldGate("some_unknown_tool")).toBe(true);
  });

  it("gates only specified tools when gatedTools is set", () => {
    const enforcer = new CapNetEnforcer({
      agentPubkey: "fakepub",
      gatedTools: ["exec", "web_fetch"],
    });
    expect(enforcer.shouldGate("exec")).toBe(true);
    expect(enforcer.shouldGate("web_fetch")).toBe(true);
    expect(enforcer.shouldGate("web_search")).toBe(false);
    expect(enforcer.shouldGate("browser")).toBe(false);
  });

  it("exempts tools in exemptTools list", () => {
    const enforcer = new CapNetEnforcer({
      agentPubkey: "fakepub",
      exemptTools: ["web_search"],
    });
    // Gate all except web_search
    expect(enforcer.shouldGate("exec")).toBe(true);
    expect(enforcer.shouldGate("web_search")).toBe(false);
  });

  it("exemptTools takes precedence over gatedTools", () => {
    const enforcer = new CapNetEnforcer({
      agentPubkey: "fakepub",
      gatedTools: ["exec", "web_search"],
      exemptTools: ["web_search"],
    });
    expect(enforcer.shouldGate("exec")).toBe(true);
    expect(enforcer.shouldGate("web_search")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tool category mapping
// ---------------------------------------------------------------------------

describe("Tool category mapping", () => {
  it("maps shell tools correctly", () => {
    expect(getToolCategory("exec")).toBe("shell");
  });

  it("maps web tools correctly", () => {
    expect(getToolCategory("web_fetch")).toBe("web");
    expect(getToolCategory("web_search")).toBe("web");
  });

  it("maps browser tools correctly", () => {
    expect(getToolCategory("browser")).toBe("browser");
    expect(getToolCategory("browser_navigate")).toBe("browser");
    expect(getToolCategory("browser_click")).toBe("browser");
  });

  it("maps messaging tools correctly", () => {
    expect(getToolCategory("whatsapp_send")).toBe("messaging");
    expect(getToolCategory("telegram_send")).toBe("messaging");
    expect(getToolCategory("slack_send")).toBe("messaging");
  });

  it("maps filesystem tools correctly", () => {
    expect(getToolCategory("fs_read")).toBe("filesystem");
    expect(getToolCategory("fs_write")).toBe("filesystem");
    expect(getToolCategory("apply_patch")).toBe("filesystem");
  });

  it("maps spawn tools correctly", () => {
    expect(getToolCategory("sessions_spawn")).toBe("spawn");
    expect(getToolCategory("sessions_send")).toBe("spawn");
  });

  it("maps device tools correctly", () => {
    expect(getToolCategory("camera")).toBe("device");
    expect(getToolCategory("location")).toBe("device");
    expect(getToolCategory("contacts")).toBe("device");
  });

  it("returns 'other' for unknown tools", () => {
    expect(getToolCategory("unknown_tool")).toBe("other");
    expect(getToolCategory("custom_skill")).toBe("other");
  });

  it("covers all entries in TOOL_CATEGORY_MAP", () => {
    // Ensure every mapped tool has a valid category
    const validCategories = new Set(["shell", "web", "browser", "messaging", "filesystem", "spawn", "device"]);
    for (const [tool, category] of Object.entries(TOOL_CATEGORY_MAP)) {
      expect(validCategories.has(category!), `${tool} → ${category}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Fail policy (proxy unreachable)
// ---------------------------------------------------------------------------

describe("CapNetEnforcer fail policy", () => {
  it("denies on proxy failure with fail-closed (default)", async () => {
    const enforcer = new CapNetEnforcer({
      proxyUrl: "http://127.0.0.1:19999", // unreachable
      agentPubkey: "fakepub",
      failPolicy: "closed",
      timeoutMs: 200,
    });

    const result = await enforcer.enforce("exec", { cmd: "ls" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("PROXY_UNREACHABLE");
    expect(result.errorType).toBe("CapNetError");
  });

  it("allows on proxy failure with fail-open", async () => {
    const enforcer = new CapNetEnforcer({
      proxyUrl: "http://127.0.0.1:19999", // unreachable
      agentPubkey: "fakepub",
      failPolicy: "open",
      timeoutMs: 200,
    });

    const result = await enforcer.enforce("exec", { cmd: "ls" });
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("PROXY_UNREACHABLE (fail-open)");
  });
});
