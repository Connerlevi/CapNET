/**
 * @capnet/shared — Public API
 *
 * Explicit exports only. Internal helpers are not exposed.
 * Schemas import from local files, not from this barrel.
 */

// -----------------------------------------------------------------------------
// Schemas (Zod validators)
// -----------------------------------------------------------------------------
export { CapDocSchema } from "./schemas/capdoc";
export {
  CartItemSchema,
  ActionRequestSchema,
  ActionResultSchema,
  DenyReasonSchema,
  ReasonSchema,
} from "./schemas/action";
export { ReceiptEventSchema, ReceiptSchema } from "./schemas/receipt";
export type { ReceiptEvent } from "./schemas/receipt";

// -----------------------------------------------------------------------------
// Types (Zod-inferred)
// -----------------------------------------------------------------------------
export type { CapDoc } from "./schemas/capdoc";
export type { CartItem, ActionRequest, ActionResult } from "./schemas/action";
export type { Receipt } from "./schemas/receipt";

// -----------------------------------------------------------------------------
// Crypto — public functions
// -----------------------------------------------------------------------------
export {
  stableStringify,
  generateEd25519Keypair,
  signObjectEd25519,
  verifyObjectEd25519,
  capUnsignedPayload,
  toBase64,
  fromBase64,
} from "./crypto";

export type { Keypair, SigningDomain } from "./crypto";
