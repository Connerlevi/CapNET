import { type Keypair, generateEd25519Keypair } from "@capnet/shared";
import { CapNetClient, type CapNetClientOptions } from "./index.js";
import type { CapNetOptions, AgentIdentityOptions, SpendOptions, ToolCallOptions } from "./types.js";
import { SpendCapabilityBuilder, ToolCallCapabilityBuilder } from "./builders.js";
import { loadOrCreateKeypair } from "./keys.js";
import { CapNetError } from "./errors.js";

const DEFAULT_SANDBOX_URL = "http://127.0.0.1:3200";

export class CapNet {
  private readonly client: CapNetClient;
  private readonly sandboxUrl: string;

  private constructor(client: CapNetClient, sandboxUrl?: string) {
    this.client = client;
    this.sandboxUrl = sandboxUrl ?? DEFAULT_SANDBOX_URL;
  }

  static async create(options?: CapNetOptions & { sandbox?: string }): Promise<CapNet> {
    const clientOpts: CapNetClientOptions = {};
    if (options?.proxy) clientOpts.proxyUrl = options.proxy;
    if (options?.timeoutMs != null) clientOpts.timeoutMs = options.timeoutMs;
    if (options?.fetchFn) clientOpts.fetchFn = options.fetchFn;

    const client = new CapNetClient(clientOpts);

    try {
      await client.health();
    } catch (err) {
      throw new CapNetError(
        `Cannot connect to CapNet proxy at ${options?.proxy ?? "http://127.0.0.1:3100"}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    return new CapNet(client, options?.sandbox);
  }

  get raw(): CapNetClient {
    return this.client;
  }

  agent(agentId: string, options?: AgentIdentityOptions): AgentBuilder {
    return new AgentBuilder(this.client, agentId, options, this.sandboxUrl);
  }
}

export class AgentBuilder {
  private readonly client: CapNetClient;
  private readonly agentId: string;
  private readonly options: AgentIdentityOptions | undefined;
  private readonly sandboxUrl: string;
  private keypairPromise: Promise<Keypair> | undefined;

  constructor(
    client: CapNetClient,
    agentId: string,
    options: AgentIdentityOptions | undefined,
    sandboxUrl: string
  ) {
    this.client = client;
    this.agentId = agentId;
    this.options = options;
    this.sandboxUrl = sandboxUrl;
  }

  private resolveKeypair = (): Promise<Keypair> => {
    if (!this.keypairPromise) {
      this.keypairPromise = this._resolveKeypair();
    }
    return this.keypairPromise;
  };

  private async _resolveKeypair(): Promise<Keypair> {
    const identity = this.options?.identity;
    if (identity && identity !== "auto") {
      return identity;
    }
    return loadOrCreateKeypair(this.agentId, this.options?.keysDir);
  }

  spend(options: SpendOptions): SpendCapabilityBuilder {
    return new SpendCapabilityBuilder(
      this.client,
      this.agentId,
      this.resolveKeypair,
      options.budget,
      options.vendors ?? ["sandboxmart"],
      options.expiresIn ?? "1h",
      this.sandboxUrl
    );
  }

  toolCalls(options: ToolCallOptions): ToolCallCapabilityBuilder {
    return new ToolCallCapabilityBuilder(
      this.client,
      this.agentId,
      this.resolveKeypair,
      options.tools,
      options.expiresIn ?? "1h",
      options.maxCalls,
      this.sandboxUrl
    );
  }
}
