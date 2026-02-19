import nacl from "tweetnacl";
import type { CapDoc } from "./schemas/capdoc";

export interface Keypair {
  publicKeyB64: string;
  secretKeyB64: string;
}

// Reusable encoder instance
const encoder = new TextEncoder();

// Domain prefixes for signature separation
const DOMAIN_CAPDOC = "capnet:capdoc/0.1:";
const DOMAIN_RECEIPT = "capnet:receipt/0.1:";
const DOMAIN_ACTION_REQUEST = "capnet:actionrequest/0.1:";

// -----------------------------------------------------------------------------
// Base64 utilities (browser + Node safe)
// -----------------------------------------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  const B = (globalThis as unknown as { Buffer?: typeof Buffer }).Buffer;
  if (B) return B.from(bytes).toString("base64");
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array {
  const B = (globalThis as unknown as { Buffer?: typeof Buffer }).Buffer;
  if (B) return new Uint8Array(B.from(b64, "base64"));
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// -----------------------------------------------------------------------------
// Key length validation
// -----------------------------------------------------------------------------

function assertLen(name: string, bytes: Uint8Array, len: number): void {
  if (bytes.length !== len) {
    throw new Error(`${name} must be ${len} bytes, got ${bytes.length}`);
  }
}

// -----------------------------------------------------------------------------
// Canonical serialization (JSON with sorted keys, strict validation)
// -----------------------------------------------------------------------------

export function stableStringify(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(value: unknown): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;

  if (typeof value === "number") {
    // JSON.stringify turns NaN/Infinity into null — fail fast instead
    if (!Number.isFinite(value)) {
      throw new Error("stableStringify: non-finite number not supported");
    }
    return value;
  }

  if (typeof value === "bigint") {
    throw new Error("stableStringify: bigint not supported");
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) return value.map(sortKeys);

    // Reject non-plain objects (Date, Map, Set, Uint8Array, etc.)
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype) {
      throw new Error("stableStringify: non-plain object not supported");
    }

    const rec = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(rec).sort()) {
      sorted[key] = sortKeys(rec[key]);
    }
    return sorted;
  }

  // string, boolean, etc.
  return value;
}

// -----------------------------------------------------------------------------
// Key generation
// -----------------------------------------------------------------------------

export function generateEd25519Keypair(): Keypair {
  const kp = nacl.sign.keyPair();
  return {
    publicKeyB64: toBase64(kp.publicKey),
    secretKeyB64: toBase64(kp.secretKey),
  };
}

// -----------------------------------------------------------------------------
// Signing (with domain separation)
// -----------------------------------------------------------------------------

export type SigningDomain = "capdoc" | "receipt" | "actionrequest";

function getDomainPrefix(domain: SigningDomain): string {
  switch (domain) {
    case "capdoc":
      return DOMAIN_CAPDOC;
    case "receipt":
      return DOMAIN_RECEIPT;
    case "actionrequest":
      return DOMAIN_ACTION_REQUEST;
  }
}

export function signObjectEd25519(
  unsignedPayload: unknown,
  secretKeyB64: string,
  domain: SigningDomain = "capdoc"
): string {
  const secretKey = fromBase64(secretKeyB64);
  assertLen("secretKey", secretKey, 64);

  const prefix = getDomainPrefix(domain);
  const message = encoder.encode(prefix + stableStringify(unsignedPayload));
  const sig = nacl.sign.detached(message, secretKey);
  return toBase64(sig);
}

export function verifyObjectEd25519(
  unsignedPayload: unknown,
  sigB64: string,
  publicKeyB64: string,
  domain: SigningDomain = "capdoc"
): boolean {
  const publicKey = fromBase64(publicKeyB64);
  assertLen("publicKey", publicKey, 32);

  const sig = fromBase64(sigB64);
  assertLen("signature", sig, 64);

  const prefix = getDomainPrefix(domain);
  const message = encoder.encode(prefix + stableStringify(unsignedPayload));
  return nacl.sign.detached.verify(message, sig, publicKey);
}

// -----------------------------------------------------------------------------
// CapDoc helpers
// -----------------------------------------------------------------------------

export function capUnsignedPayload(cap: CapDoc): Omit<CapDoc, "proof"> {
  const { proof: _, ...unsigned } = cap;
  return unsigned;
}
