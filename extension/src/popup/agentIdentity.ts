/**
 * Agent Identity Management
 *
 * Generates and persists an Ed25519 keypair for the demo wallet agent.
 *
 * SECURITY NOTE (demo-only):
 * - Secret key is stored in chrome.storage.local for demo persistence
 * - Production should use: WebAuthn, native host, OS keychain, or secure element
 * - Consider chrome.storage.session for non-persistent keys
 *
 * Migration: Storage key is versioned (v1) for future schema changes.
 */

import nacl from "tweetnacl";

const STORAGE_KEY = "capnet_agent_identity_v1";

export interface AgentIdentity {
  agent_id: string;
  pubkey_b64: string;
  /**
   * DEMO-ONLY: Secret key stored locally for persistence.
   * Replace with secure key storage before production.
   */
  secretkey_b64: string;
  /** ISO timestamp when keypair was generated */
  created_at: string;
}

/**
 * Runtime shape validation (guards against corrupted storage).
 */
function isIdentity(x: unknown): x is AgentIdentity {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.agent_id === "string" &&
    typeof obj.pubkey_b64 === "string" &&
    typeof obj.secretkey_b64 === "string" &&
    (obj.created_at === undefined || typeof obj.created_at === "string")
  );
}

/**
 * Base64 helpers for small Uint8Arrays (32/64 bytes).
 * Uses btoa/atob which is safe for key-sized buffers.
 * Do NOT use for arbitrary binary data > 1KB.
 */
const b64 = {
  to: (u8: Uint8Array): string => btoa(String.fromCharCode(...u8)),
  from: (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

/**
 * Load existing agent identity or create a new one.
 * First run: generates keypair and stores it.
 * Subsequent runs: loads from chrome.storage.local.
 */
export async function loadOrCreateAgentIdentity(
  defaultAgentId = "agent:demo-wallet"
): Promise<AgentIdentity> {
  const existing = await chrome.storage.local.get(STORAGE_KEY);
  const stored = existing[STORAGE_KEY];
  if (isIdentity(stored)) {
    // Migrate old identities without created_at
    if (!stored.created_at) {
      stored.created_at = new Date().toISOString();
      await chrome.storage.local.set({ [STORAGE_KEY]: stored });
    }
    return stored;
  }

  const kp = nacl.sign.keyPair();
  const identity: AgentIdentity = {
    agent_id: defaultAgentId,
    pubkey_b64: b64.to(kp.publicKey),
    secretkey_b64: b64.to(kp.secretKey),
    created_at: new Date().toISOString(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: identity });
  return identity;
}

/**
 * Update the agent_id while preserving the keypair.
 */
export async function setAgentId(agent_id: string): Promise<AgentIdentity> {
  const existing = await chrome.storage.local.get(STORAGE_KEY);
  const stored = existing[STORAGE_KEY];

  if (!isIdentity(stored)) {
    return loadOrCreateAgentIdentity(agent_id);
  }

  const updated: AgentIdentity = { ...stored, agent_id };
  await chrome.storage.local.set({ [STORAGE_KEY]: updated });
  return updated;
}

/**
 * Get current identity without creating one.
 * Returns null if no identity exists or is corrupted.
 */
export async function getAgentIdentity(): Promise<AgentIdentity | null> {
  const existing = await chrome.storage.local.get(STORAGE_KEY);
  const stored = existing[STORAGE_KEY];
  return isIdentity(stored) ? stored : null;
}

/**
 * Generate a new keypair, replacing the existing one.
 * Use for testing executor mismatch scenarios.
 * WARNING: Old capabilities will no longer work with the new identity.
 */
export async function resetAgentIdentity(
  agentId?: string
): Promise<AgentIdentity> {
  const existing = await getAgentIdentity();
  const id = agentId ?? existing?.agent_id ?? "agent:demo-wallet";

  const kp = nacl.sign.keyPair();
  const identity: AgentIdentity = {
    agent_id: id,
    pubkey_b64: b64.to(kp.publicKey),
    secretkey_b64: b64.to(kp.secretKey),
    created_at: new Date().toISOString(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: identity });
  return identity;
}

/** Validate agent ID format: agent:[a-z0-9._:-]{3,64} */
export function isValidAgentId(s: string): boolean {
  return /^agent:[a-z0-9._:-]{3,64}$/i.test(s);
}
