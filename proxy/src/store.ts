import fs from "fs";
import path from "path";
import type { CapDoc, Receipt } from "@capnet/shared";

// -----------------------------------------------------------------------------
// Data directory (stable path, env override supported)
// -----------------------------------------------------------------------------

const DATA_DIR = process.env.CAPNET_DATA_DIR
  ? path.resolve(process.env.CAPNET_DATA_DIR)
  : path.resolve(process.cwd(), "data");

const CAPS_FILE = path.join(DATA_DIR, "caps.json");
const RECEIPTS_FILE = path.join(DATA_DIR, "receipts.jsonl");
const KEYS_FILE = path.join(DATA_DIR, "issuer_keys.json");
const REVOKED_FILE = path.join(DATA_DIR, "revoked.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// -----------------------------------------------------------------------------
// Atomic file writes (crash-safe)
// -----------------------------------------------------------------------------

function atomicWriteFile(filePath: string, contents: string) {
  ensureDataDir();
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, contents, "utf-8");
  fs.renameSync(tmp, filePath);
}

function atomicWriteJson(filePath: string, obj: unknown) {
  atomicWriteFile(filePath, JSON.stringify(obj, null, 2));
}

// -----------------------------------------------------------------------------
// Capabilities
// -----------------------------------------------------------------------------

let capsCache: Record<string, CapDoc> | null = null;

function loadCaps(): Record<string, CapDoc> {
  if (capsCache) return capsCache;
  ensureDataDir();
  if (fs.existsSync(CAPS_FILE)) {
    try {
      capsCache = JSON.parse(fs.readFileSync(CAPS_FILE, "utf-8"));
    } catch (err) {
      console.error("[store] Failed to parse caps.json, starting fresh:", err);
      capsCache = {};
    }
  } else {
    capsCache = {};
  }
  return capsCache!;
}

function saveCaps() {
  atomicWriteJson(CAPS_FILE, capsCache);
}

export function storeCap(cap: CapDoc) {
  const caps = loadCaps();
  caps[cap.cap_id] = cap;
  saveCaps();
}

export function getCap(capId: string): CapDoc | undefined {
  return loadCaps()[capId];
}

export function getAllCaps(): CapDoc[] {
  return Object.values(loadCaps());
}

/**
 * Find a capability for the given agent.
 *
 * Selection policy (deterministic, documented):
 * 1. Filter to caps matching agent_id + agent_pubkey
 * 2. Prefer non-revoked caps; fall back to revoked (so enforcement can return REVOKED)
 * 3. Sort by issued_at descending (newest first)
 * 4. Break ties by expires_at ascending (earlier expiry first)
 * 5. Return the first cap
 *
 * This ensures predictable behavior in demos and audits.
 * Revoked caps are still returned so the enforcement pipeline can produce
 * a clear REVOKED denial instead of a generic NO_CAPABILITY.
 */
export function findCapForAgent(
  agentId: string,
  agentPubkey: string
): CapDoc | undefined {
  loadRevoked(); // ensure revoked set is loaded
  const caps = loadCaps();

  const matching = Object.values(caps).filter(
    (c) =>
      c.executor.agent_id === agentId &&
      c.executor.agent_pubkey === agentPubkey
  );

  if (matching.length === 0) return undefined;

  // Sort: non-revoked first, then by newest issued, then earliest expiry
  matching.sort((a, b) => {
    const aRevoked = revokedSet.has(a.cap_id) ? 1 : 0;
    const bRevoked = revokedSet.has(b.cap_id) ? 1 : 0;
    if (aRevoked !== bRevoked) return aRevoked - bRevoked; // non-revoked first

    const aIssued = Date.parse(a.issued_at) || 0;
    const bIssued = Date.parse(b.issued_at) || 0;
    if (aIssued !== bIssued) return bIssued - aIssued; // newest first

    const aExp = Date.parse(a.expires_at) || 0;
    const bExp = Date.parse(b.expires_at) || 0;
    return aExp - bExp; // earlier expiry first
  });

  return matching[0];
}

// -----------------------------------------------------------------------------
// Revocation (persisted to disk)
// -----------------------------------------------------------------------------

const revokedSet = new Set<string>();
let revokedLoaded = false;

function loadRevoked() {
  if (revokedLoaded) return;
  ensureDataDir();
  if (fs.existsSync(REVOKED_FILE)) {
    try {
      const arr = JSON.parse(fs.readFileSync(REVOKED_FILE, "utf-8"));
      if (Array.isArray(arr)) {
        arr.forEach((id) => revokedSet.add(String(id)));
      }
    } catch (err) {
      console.error("[store] Failed to parse revoked.json, starting fresh:", err);
    }
  }
  revokedLoaded = true;
}

function saveRevoked() {
  atomicWriteJson(REVOKED_FILE, Array.from(revokedSet));
}

export function revokeCap(capId: string) {
  loadRevoked();
  revokedSet.add(capId);
  saveRevoked();
}

export function isRevoked(capId: string): boolean {
  loadRevoked();
  return revokedSet.has(capId);
}

// -----------------------------------------------------------------------------
// Receipts
// -----------------------------------------------------------------------------

export function appendReceipt(receipt: Receipt) {
  ensureDataDir();
  fs.appendFileSync(RECEIPTS_FILE, JSON.stringify(receipt) + "\n");
}

/**
 * Get receipts from the log.
 * Skips malformed lines instead of crashing (robust to corruption).
 */
export function getReceipts(limit = 100, since?: string): Receipt[] {
  ensureDataDir();
  if (!fs.existsSync(RECEIPTS_FILE)) return [];

  const raw = fs.readFileSync(RECEIPTS_FILE, "utf-8");
  const lines = raw.split("\n").filter(Boolean);

  const out: Receipt[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // Skip corrupt lines, could log if needed
    }
  }

  let receipts = out;
  if (since) {
    receipts = receipts.filter((r) => r.ts >= since);
  }
  return receipts.slice(-limit);
}

// -----------------------------------------------------------------------------
// Issuer keys
// -----------------------------------------------------------------------------

export interface IssuerKeys {
  publicKeyB64: string;
  secretKeyB64: string;
}

export function loadOrCreateIssuerKeys(
  generate: () => IssuerKeys
): IssuerKeys {
  ensureDataDir();
  if (fs.existsSync(KEYS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
    } catch (err) {
      console.error("[store] Failed to parse issuer_keys.json, regenerating:", err);
    }
  }
  const keys = generate();
  atomicWriteJson(KEYS_FILE, keys);
  return keys;
}
