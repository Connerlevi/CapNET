/**
 * CapNet MCP Gateway — Enforcer
 *
 * Validates tool calls against CapNet capabilities before forwarding
 * to upstream MCP servers. Uses the same enforcement pipeline as the
 * OpenClaw plugin but adapted for MCP tool calls.
 */

import crypto from "crypto";
import type { ToolCallRequest } from "@capnet-auth/shared";
import { CapNetClient, loadOrCreateKeypair, classifyDenialError } from "@capnet-auth/sdk";
import type { DeniedError } from "@capnet-auth/sdk";
import type { GatewayConfig } from "./types.js";
import { classifyTool } from "./types.js";

export interface EnforcementResult {
  allowed: boolean;
  reason: string;
  errorType?: string | undefined;
  receiptId?: string | undefined;
  latencyMs: number;
}

export class GatewayEnforcer {
  private client: CapNetClient;
  private agentId: string;
  private agentPubkey: string;
  private failPolicy: "closed" | "open";
  private keysDir: string | undefined;
  private identityReady: Promise<void> | undefined;

  constructor(config: GatewayConfig) {
    this.client = new CapNetClient({
      proxyUrl: config.proxyUrl ?? "http://127.0.0.1:3100",
      timeoutMs: config.timeoutMs ?? 2000,
    });

    this.agentId = config.agentId ?? "agent:mcp";
    this.agentPubkey = config.agentPubkey ?? "";
    this.failPolicy = config.failPolicy ?? "closed";
    this.keysDir = config.keysDir;

    if (!this.agentPubkey) {
      this.identityReady = this.resolveIdentity();
    }
  }

  private async resolveIdentity(): Promise<void> {
    const keypair = await loadOrCreateKeypair(this.agentId, this.keysDir);
    this.agentPubkey = keypair.publicKeyB64;
  }

  async ensureReady(): Promise<void> {
    if (this.identityReady) {
      await this.identityReady;
      this.identityReady = undefined;
    }
  }

  get publicKey(): string {
    return this.agentPubkey;
  }

  get id(): string {
    return this.agentId;
  }

  /** Check if the CapNet proxy is reachable */
  async checkProxy(): Promise<boolean> {
    try {
      const health = await this.client.health();
      return health.status === "ok";
    } catch {
      return false;
    }
  }

  /** Enforce a tool call through the CapNet proxy */
  async enforce(
    toolName: string,
    toolArgs: Record<string, unknown>,
    toolCategory?: string
  ): Promise<EnforcementResult> {
    await this.ensureReady();
    const start = Date.now();

    const category = toolCategory ?? classifyTool(toolName);

    const request: ToolCallRequest = {
      request_id: `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      ts: new Date().toISOString(),
      agent_id: this.agentId,
      agent_pubkey: this.agentPubkey,
      action: "tool_call",
      tool_name: toolName.toLowerCase(),
      tool_category: category as ToolCallRequest["tool_category"],
      tool_input: toolArgs,
    };

    try {
      const result = await this.client.submitToolCall(request);

      if (result.decision === "allow") {
        return {
          allowed: true,
          reason: result.reason,
          receiptId: result.receipt_id,
          latencyMs: Date.now() - start,
        };
      }

      let typedError: DeniedError | undefined;
      try {
        typedError = classifyDenialError(result, { tool: toolName });
      } catch {
        // classification is best-effort
      }

      return {
        allowed: false,
        reason: result.reason,
        errorType: typedError?.name,
        receiptId: result.receipt_id,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errMsg = err instanceof Error ? err.message : String(err);

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
        errorType: "CapNetError",
        latencyMs,
      };
    }
  }
}
