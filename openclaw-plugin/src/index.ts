/**
 * @capnet/openclaw-plugin — CapNet enforcement for OpenClaw agents
 *
 * This plugin hooks into OpenClaw's before_tool_call and after_tool_call
 * lifecycle events to enforce CapNet capabilities on every tool invocation.
 *
 * Architecture:
 *   OpenClaw agent → before_tool_call hook → CapNet proxy → allow/deny
 *   If denied, the tool call is blocked before execution.
 *   If proxy is unreachable, fail policy determines behavior.
 *
 * Installation:
 *   1. Add to OpenClaw plugins config: { "id": "capnet", "enabled": true }
 *   2. Start CapNet proxy: npm run dev (from CapNet project)
 *   3. Issue a tool_call capability for the agent
 *   4. Start OpenClaw — all gated tool calls route through CapNet
 */

import { CapNetEnforcer } from "./enforcer.js";
import type { CapNetPluginConfig, OpenClawPluginApi } from "./types.js";

/**
 * OpenClaw plugin registration entry point.
 * Called by OpenClaw's plugin loader when the plugin is activated.
 */
export function register(api: OpenClawPluginApi): void {
  const config = (api.pluginConfig ?? {}) as CapNetPluginConfig;

  const enforcer = new CapNetEnforcer(config);

  api.logger.info(
    `[capnet] Enforcement active | proxy=${config.proxyUrl ?? "http://127.0.0.1:3100"} ` +
    `| fail=${config.failPolicy ?? "closed"} ` +
    `| agent=${config.agentId ?? "agent:openclaw"}`
  );

  if (config.gatedTools) {
    api.logger.info(`[capnet] Gating ${config.gatedTools.length} specific tools: ${config.gatedTools.join(", ")}`);
  } else {
    api.logger.info("[capnet] Gating ALL tools (no gatedTools list specified)");
  }

  if (config.exemptTools && config.exemptTools.length > 0) {
    api.logger.info(`[capnet] Exempt tools: ${config.exemptTools.join(", ")}`);
  }

  // ---------------------------------------------------------------------------
  // before_tool_call — enforce capability before tool execution
  // ---------------------------------------------------------------------------

  api.registerHook("before_tool_call", async (toolCall: unknown) => {
    const tc = toolCall as { name?: string; args?: Record<string, unknown> } | undefined;
    const toolName = tc?.name ?? "unknown";
    const toolArgs = tc?.args ?? {};

    // Skip tools not gated by CapNet
    if (!enforcer.shouldGate(toolName)) {
      return undefined; // pass through, don't modify
    }

    const result = await enforcer.enforce(toolName, toolArgs);

    if (result.allowed) {
      api.logger.info(
        `[capnet] ALLOW ${toolName} (${result.latencyMs}ms) receipt=${result.receiptId ?? "n/a"}`
      );
      return undefined; // pass through
    }

    // Denied — block the tool call
    api.logger.warn(
      `[capnet] DENY ${toolName} reason=${result.reason} (${result.latencyMs}ms)`
    );

    return {
      blocked: `[CapNet] Tool call "${toolName}" denied: ${formatDenyReason(result.reason)}`,
    };
  }, { priority: 1000 }); // High priority — run before other hooks

  // ---------------------------------------------------------------------------
  // after_tool_call — audit logging
  // ---------------------------------------------------------------------------

  api.registerHook("after_tool_call", (toolCall: unknown, toolResult: unknown) => {
    const tc = toolCall as { name?: string } | undefined;
    const toolName = tc?.name ?? "unknown";

    if (!enforcer.shouldGate(toolName)) return;

    // The tool executed — it was already allowed in before_tool_call.
    // This hook is purely observational for audit completeness.
    api.logger.info(`[capnet] Tool completed: ${toolName}`);
  });

  // ---------------------------------------------------------------------------
  // HTTP route — CapNet status endpoint
  // ---------------------------------------------------------------------------

  api.registerHttpRoute({
    path: "/capnet/status",
    handler: (_req: unknown, res: unknown) => {
      const r = res as { json: (body: unknown) => void };
      r.json({
        plugin: "capnet",
        version: "0.1.0",
        proxyUrl: config.proxyUrl ?? "http://127.0.0.1:3100",
        agentId: config.agentId ?? "agent:openclaw",
        failPolicy: config.failPolicy ?? "closed",
        gatedTools: config.gatedTools ?? "all",
        exemptTools: config.exemptTools ?? [],
      });
    },
  });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Human-readable deny reasons for agent-facing messages */
function formatDenyReason(reason: string): string {
  const reasons: Record<string, string> = {
    NO_CAPABILITY: "No active capability found for this agent. Ask the user to issue one.",
    REVOKED: "Your capability has been revoked by the user.",
    CAP_EXPIRED: "Your capability has expired. Ask the user for a new one.",
    CAP_NOT_YET_VALID: "Your capability is not yet valid.",
    EXECUTOR_MISMATCH: "Agent identity doesn't match the capability.",
    TOOL_NOT_ALLOWED: "This tool is not in the allowed tools list.",
    ACTION_NOT_ALLOWED: "This action type is not permitted by your capability.",
    PROXY_UNREACHABLE: "CapNet proxy is unreachable and fail-closed policy is active.",
  };

  if (reason.startsWith("TOOL_CATEGORY_BLOCKED:")) {
    const category = reason.split(":")[1] ?? "unknown";
    return `Tools in the "${category}" category are blocked by your capability.`;
  }

  return reasons[reason] ?? reason;
}

// Default export for OpenClaw plugin loader
export default { register };
