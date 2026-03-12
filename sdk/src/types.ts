import type { Keypair } from "@capnet-auth/shared";

export interface CapNetOptions {
  proxy?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface AgentIdentityOptions {
  identity?: "auto" | Keypair;
  keysDir?: string;
}

export interface SpendOptions {
  budget: string;
  vendors?: string[];
  expiresIn?: string;
}

export interface ToolCallOptions {
  tools: string[];
  expiresIn?: string;
  maxCalls?: number;
}

export interface DelegateOptions {
  to: string;
  budget?: string;
  tools?: string[];
  expiresIn?: string;
  blockedCategories?: string[];
  identity?: "auto" | Keypair;
}
