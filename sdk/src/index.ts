/**
 * CapNet SDK Client
 *
 * Client library for agents to interact with the CapNet proxy.
 * Provides typed methods with timeouts, consistent error handling,
 * and injectable fetch for testing.
 */

import type {
  CapDoc,
  ActionRequest,
  ActionResult,
  ToolCallRequest,
  Receipt,
} from "@capnet/shared";

export interface CapNetClientOptions {
  /** Proxy URL (default: http://127.0.0.1:3100) */
  proxyUrl?: string;
  /** Request timeout in ms (default: 2500) */
  timeoutMs?: number;
  /** Custom fetch implementation for tests/mocks */
  fetchFn?: typeof fetch;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export interface IssueCapabilityRequest {
  template: string;
  agent_id: string;
  agent_pubkey: string;
  constraints: {
    max_amount_cents: number;
    allowed_vendors: string[];
    blocked_categories: string[];
  };
}

export interface IssueToolCallCapabilityRequest {
  template: string;
  agent_id: string;
  agent_pubkey: string;
  constraints: {
    allowed_tools: string[];
    blocked_tool_categories: string[];
    max_calls?: number;
  };
}

export interface RevokeResponse {
  success: boolean;
  cap_id: string;
  message: string;
}

export class CapNetClient {
  private proxyUrl: string;
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor(options: CapNetClientOptions = {}) {
    this.proxyUrl = (options.proxyUrl ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Internal request helper with timeout, error handling, and JSON support.
   */
  private async request<T>(
    path: string,
    init: RequestInit & { json?: unknown } = {}
  ): Promise<T> {
    const url = `${this.proxyUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(init.headers as Record<string, string> | undefined),
      };

      // Build fetch options (avoid setting undefined values for exactOptionalPropertyTypes)
      const fetchOptions: RequestInit = {
        headers,
        signal: controller.signal,
      };
      if (init.method) fetchOptions.method = init.method;
      if (init.json !== undefined) {
        headers["Content-Type"] = "application/json";
        fetchOptions.body = JSON.stringify(init.json);
      } else if (init.body) {
        fetchOptions.body = init.body;
      }

      const res = await this.fetchFn(url, fetchOptions);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const method = init.method ?? "GET";
        throw new Error(
          `HTTP ${res.status} ${method} ${url}: ${text.slice(0, 200)}`
        );
      }

      // Handle empty responses safely
      const text = await res.text();
      return text ? (JSON.parse(text) as T) : (undefined as T);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        const method = init.method ?? "GET";
        throw new Error(`Request timeout after ${this.timeoutMs}ms: ${method} ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  /** Check proxy health */
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  // ---------------------------------------------------------------------------
  // Capabilities
  // ---------------------------------------------------------------------------

  /** Issue a new spend capability */
  async issueCapability(req: IssueCapabilityRequest): Promise<CapDoc> {
    return this.request<CapDoc>("/capability/issue", {
      method: "POST",
      json: req,
    });
  }

  /** Issue a new tool_call capability */
  async issueToolCallCapability(req: IssueToolCallCapabilityRequest): Promise<CapDoc> {
    return this.request<CapDoc>("/capability/issue/toolcall", {
      method: "POST",
      json: req,
    });
  }

  /** List all capabilities with revocation status */
  async listCapabilities(): Promise<(CapDoc & { is_revoked: boolean })[]> {
    return this.request<(CapDoc & { is_revoked: boolean })[]>("/capabilities");
  }

  /** Revoke a capability by ID */
  async revokeCapability(capId: string): Promise<RevokeResponse> {
    return this.request<RevokeResponse>("/capability/revoke", {
      method: "POST",
      json: { cap_id: capId },
    });
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Submit a spend action request for enforcement */
  async submitAction(actionRequest: ActionRequest): Promise<ActionResult> {
    return this.request<ActionResult>("/action/request", {
      method: "POST",
      json: actionRequest,
    });
  }

  /** Submit a tool call request for enforcement */
  async submitToolCall(toolCallRequest: ToolCallRequest): Promise<ActionResult> {
    return this.request<ActionResult>("/action/toolcall", {
      method: "POST",
      json: toolCallRequest,
    });
  }

  // ---------------------------------------------------------------------------
  // Receipts
  // ---------------------------------------------------------------------------

  /** Query receipts with optional filtering */
  async listReceipts(options?: { limit?: number; since?: string }): Promise<Receipt[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.since) params.set("since", options.since);

    const query = params.toString();
    const path = query ? `/receipts?${query}` : "/receipts";
    return this.request<Receipt[]>(path);
  }
}

// Re-export types for convenience
export type { CapDoc, ActionRequest, ActionResult, ToolCallRequest, Receipt } from "@capnet/shared";
