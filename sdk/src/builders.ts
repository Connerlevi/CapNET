import type { CapNetClient } from "./index.js";
import type { Keypair } from "@capnet-auth/shared";
import { CapabilityHandle } from "./handle.js";
import { parseBudget, durationToExpiry } from "./parsers.js";

export class SpendCapabilityBuilder {
  private readonly client: CapNetClient;
  private readonly agentId: string;
  private readonly resolveKeypair: () => Promise<Keypair>;
  private readonly budget: string;
  private readonly vendors: string[];
  private readonly expiresIn: string;
  private readonly sandboxUrl: string;
  private blockedCategories: string[] = [];

  constructor(
    client: CapNetClient,
    agentId: string,
    resolveKeypair: () => Promise<Keypair>,
    budget: string,
    vendors: string[],
    expiresIn: string,
    sandboxUrl: string
  ) {
    this.client = client;
    this.agentId = agentId;
    this.resolveKeypair = resolveKeypair;
    this.budget = budget;
    this.vendors = vendors;
    this.expiresIn = expiresIn;
    this.sandboxUrl = sandboxUrl;
  }

  block(...categories: string[]): this {
    this.blockedCategories.push(...categories);
    return this;
  }

  async issue(): Promise<CapabilityHandle> {
    const keypair = await this.resolveKeypair();
    const parsed = parseBudget(this.budget);

    const capDoc = await this.client.issueCapability({
      template: "spend",
      agent_id: this.agentId,
      agent_pubkey: keypair.publicKeyB64,
      constraints: {
        max_amount_cents: parsed.cents,
        allowed_vendors: this.vendors,
        blocked_categories: this.blockedCategories,
      },
    });

    return new CapabilityHandle(
      capDoc,
      this.client,
      this.agentId,
      keypair.publicKeyB64,
      this.sandboxUrl
    );
  }
}

export class ToolCallCapabilityBuilder {
  private readonly client: CapNetClient;
  private readonly agentId: string;
  private readonly resolveKeypair: () => Promise<Keypair>;
  private readonly tools: string[];
  private readonly expiresIn: string;
  private readonly maxCalls: number | undefined;
  private readonly sandboxUrl: string;
  private blockedToolCategories: string[] = [];

  constructor(
    client: CapNetClient,
    agentId: string,
    resolveKeypair: () => Promise<Keypair>,
    tools: string[],
    expiresIn: string,
    maxCalls: number | undefined,
    sandboxUrl: string
  ) {
    this.client = client;
    this.agentId = agentId;
    this.resolveKeypair = resolveKeypair;
    this.tools = tools;
    this.expiresIn = expiresIn;
    this.maxCalls = maxCalls;
    this.sandboxUrl = sandboxUrl;
  }

  block(...categories: string[]): this {
    this.blockedToolCategories.push(...categories);
    return this;
  }

  async issue(): Promise<CapabilityHandle> {
    const keypair = await this.resolveKeypair();

    const constraints: {
      allowed_tools: string[];
      blocked_tool_categories: string[];
      max_calls?: number;
    } = {
      allowed_tools: this.tools,
      blocked_tool_categories: this.blockedToolCategories,
    };

    if (this.maxCalls != null) {
      constraints.max_calls = this.maxCalls;
    }

    const capDoc = await this.client.issueToolCallCapability({
      template: "tool_call",
      agent_id: this.agentId,
      agent_pubkey: keypair.publicKeyB64,
      constraints,
    });

    return new CapabilityHandle(
      capDoc,
      this.client,
      this.agentId,
      keypair.publicKeyB64,
      this.sandboxUrl
    );
  }
}
