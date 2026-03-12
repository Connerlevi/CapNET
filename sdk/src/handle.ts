import type { CapDoc, ActionResult, ToolCategory } from "@capnet-auth/shared";
import type { CapNetClient } from "./index.js";
import type { DelegateOptions } from "./types.js";
import { classifyDenialError } from "./errors.js";
import { parseBudget, durationToExpiry } from "./parsers.js";
import { loadOrCreateKeypair } from "./keys.js";
import { generateEd25519Keypair, type Keypair } from "@capnet-auth/shared";

function makeRequestId(): string {
  const ts = Date.now();
  const hex = Math.random().toString(16).slice(2, 10);
  return `req_${ts}_${hex}`;
}

export class CapabilityHandle {
  readonly capDoc: CapDoc;
  readonly capId: string;
  private readonly client: CapNetClient;
  private readonly agentId: string;
  private readonly agentPubkey: string;
  private readonly sandboxUrl: string;

  constructor(
    capDoc: CapDoc,
    client: CapNetClient,
    agentId: string,
    agentPubkey: string,
    sandboxUrl: string
  ) {
    this.capDoc = capDoc;
    this.capId = capDoc.cap_id;
    this.client = client;
    this.agentId = agentId;
    this.agentPubkey = agentPubkey;
    this.sandboxUrl = sandboxUrl;
  }

  get isExpired(): boolean {
    return new Date(this.capDoc.expires_at).getTime() < Date.now();
  }

  get budgetCents(): number | undefined {
    const c = this.capDoc.constraints;
    if ("max_amount_cents" in c) {
      return c.max_amount_cents;
    }
    return undefined;
  }

  get allowedTools(): string[] | undefined {
    const c = this.capDoc.constraints;
    if ("allowed_tools" in c) {
      return c.allowed_tools;
    }
    return undefined;
  }

  async purchase(
    cart: Array<{ sku: string; qty: number }>
  ): Promise<ActionResult> {
    // Step 1: Validate cart via sandbox
    const validateUrl = `${this.sandboxUrl}/cart/validate`;
    const validateRes = await fetch(validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: this.agentId,
        agent_pubkey: this.agentPubkey,
        cart,
      }),
    });

    if (!validateRes.ok) {
      const text = await validateRes.text().catch(() => "");
      throw new Error(`Cart validation failed: HTTP ${validateRes.status}: ${text.slice(0, 200)}`);
    }

    const validated = (await validateRes.json()) as {
      action_request: {
        request_id: string;
        ts: string;
        agent_id: string;
        agent_pubkey: string;
        action: "spend";
        vendor: string;
        currency: "USD";
        cart: Array<{
          name: string;
          category: string;
          price_cents: number;
          qty: number;
          sku?: string;
        }>;
      };
    };

    // Step 2: Submit to proxy for enforcement
    const result = await this.client.submitAction(validated.action_request);

    if (result.decision === "deny") {
      throw classifyDenialError(result);
    }

    return result;
  }

  async execute(
    toolName: string,
    toolInput?: Record<string, unknown>,
    category?: ToolCategory
  ): Promise<ActionResult> {
    const request = {
      request_id: makeRequestId(),
      ts: new Date().toISOString(),
      agent_id: this.agentId,
      agent_pubkey: this.agentPubkey,
      action: "tool_call" as const,
      tool_name: toolName,
      tool_category: category ?? ("other" as ToolCategory),
      ...(toolInput ? { tool_input: toolInput } : { tool_input: {} }),
    };

    const result = await this.client.submitToolCall(request);

    if (result.decision === "deny") {
      throw classifyDenialError(result, { tool: toolName });
    }

    return result;
  }

  async delegate(options: DelegateOptions): Promise<CapabilityHandle> {
    // Resolve delegate keypair
    let delegateKeypair: Keypair;
    if (options.identity && options.identity !== "auto") {
      delegateKeypair = options.identity;
    } else {
      delegateKeypair = await loadOrCreateKeypair(options.to);
    }

    const constraints: Record<string, unknown> = {};

    if (options.budget) {
      const parsed = parseBudget(options.budget);
      constraints["max_amount_cents"] = parsed.cents;
    }
    if (options.tools) {
      constraints["allowed_tools"] = options.tools;
    }
    if (options.blockedCategories) {
      // Use the correct field based on capability type
      if ("allowed_tools" in this.capDoc.constraints) {
        constraints["blocked_tool_categories"] = options.blockedCategories;
      } else {
        constraints["blocked_categories"] = options.blockedCategories;
      }
    }

    const delegateReq: {
      parent_cap_id: string;
      new_executor: { agent_id: string; agent_pubkey: string };
      constraints: Record<string, unknown>;
      expires_at?: string;
    } = {
      parent_cap_id: this.capId,
      new_executor: {
        agent_id: options.to,
        agent_pubkey: delegateKeypair.publicKeyB64,
      },
      constraints,
    };

    if (options.expiresIn) {
      delegateReq.expires_at = durationToExpiry(options.expiresIn);
    }

    const childDoc = await this.client.delegateCapability(delegateReq);
    return new CapabilityHandle(
      childDoc,
      this.client,
      options.to,
      delegateKeypair.publicKeyB64,
      this.sandboxUrl
    );
  }

  async revoke(): Promise<void> {
    await this.client.revokeCapability(this.capId);
  }
}
