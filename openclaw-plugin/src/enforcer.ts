/**
 * CapNet OpenClaw Plugin — Enforcer
 *
 * Wraps the CapNet SDK to enforce tool call capabilities.
 * Handles proxy communication, fail policy, and request construction.
 */

import crypto from "crypto";
import type { ToolCallRequest } from "@capnet/shared";
import { CapNetClient } from "@capnet/sdk";
import { getToolCategory } from "./types.js";
import type { CapNetPluginConfig } from "./types.js";

export interface EnforcementResult {
  allowed: boolean;
  reason: string;
  receiptId?: string;
  latencyMs: number;
}

export class CapNetEnforcer {
  private client: CapNetClient;
  private agentId: string;
  private agentPubkey: string;
  private failPolicy: "closed" | "open";
  private gatedTools: Set<string> | null; // null = gate all
  private exemptTools: Set<string>;

  constructor(config: CapNetPluginConfig) {
    this.client = new CapNetClient({
      proxyUrl: config.proxyUrl ?? "http://127.0.0.1:3100",
      timeoutMs: config.timeoutMs ?? 500,
    });

    this.agentId = config.agentId ?? "agent:openclaw";
    this.agentPubkey = config.agentPubkey ?? "";
    this.failPolicy = config.failPolicy ?? "closed";
    this.gatedTools = config.gatedTools ? new Set(config.gatedTools) : null;
    this.exemptTools = new Set(config.exemptTools ?? []);
  }

  /** Check if a tool should be gated through CapNet */
  shouldGate(toolName: string): boolean {
    if (this.exemptTools.has(toolName)) return false;
    if (this.gatedTools === null) return true; // gate all
    return this.gatedTools.has(toolName);
  }

  /** Enforce a tool call through the CapNet proxy */
  async enforce(toolName: string, toolInput: Record<string, unknown>): Promise<EnforcementResult> {
    const start = Date.now();

    const request: ToolCallRequest = {
      request_id: `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      ts: new Date().toISOString(),
      agent_id: this.agentId,
      agent_pubkey: this.agentPubkey,
      action: "tool_call",
      tool_name: toolName.toLowerCase(),
      tool_category: getToolCategory(toolName) as ToolCallRequest["tool_category"],
      tool_input: toolInput,
    };

    try {
      // Submit to proxy's tool_call enforcement endpoint
      const result = await this.client.submitToolCall(request);

      return {
        allowed: result.decision === "allow",
        reason: result.reason,
        receiptId: result.receipt_id,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errMsg = err instanceof Error ? err.message : String(err);

      // Apply fail policy
      if (this.failPolicy === "open") {
        return {
          allowed: true,
          reason: `PROXY_UNREACHABLE (fail-open): ${errMsg}`,
          latencyMs,
        };
      }

      return {
        allowed: false,
        reason: "PROXY_UNREACHABLE",
        latencyMs,
      };
    }
  }
}
