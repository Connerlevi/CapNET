import { z } from "zod";

/** Action schemas — protocol-grade */

// -----------------------------------------------------------------------------
// Shared validators
// -----------------------------------------------------------------------------

/** Base64 format validator */
const Base64Schema = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, "must be valid base64");

/** Ed25519 public key: base64, decodes to 32 bytes */
const Ed25519PubkeySchema = Base64Schema.refine(
  (b64) => {
    try {
      const len = Math.floor((b64.replace(/=/g, "").length * 3) / 4);
      return len === 32;
    } catch {
      return false;
    }
  },
  { message: "must be 32-byte Ed25519 public key (base64)" }
);

/** Normalized string: trimmed, lowercase, bounded length */
const NormalizedString = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .transform((s) => s.toLowerCase());

/** Category string: normalized */
const CategoryString = NormalizedString;

/** Vendor string: normalized */
const VendorString = NormalizedString;

// -----------------------------------------------------------------------------
// Reason codes (deterministic, bounded vocabulary)
// -----------------------------------------------------------------------------

export const DenyReasonSchema = z.union([
  z.literal("NO_CAPABILITY"),
  z.literal("REVOKED"),
  z.literal("CAP_EXPIRED"),
  z.literal("CAP_NOT_YET_VALID"),
  z.literal("BAD_SIGNATURE"),
  z.literal("BAD_CAPABILITY_TIME"),
  z.literal("EXECUTOR_MISMATCH"),
  z.literal("VENDOR_NOT_ALLOWED"),
  z.literal("AMOUNT_EXCEEDS_MAX"),
  z.string().regex(/^CATEGORY_BLOCKED:[a-z0-9_-]+$/i, "CATEGORY_BLOCKED:<category>"),
]);

export const ReasonSchema = z.union([z.literal("ALLOWED"), DenyReasonSchema]);

// -----------------------------------------------------------------------------
// Cart item
// -----------------------------------------------------------------------------

export const CartItemSchema = z
  .object({
    sku: z.string().max(64).optional(),
    name: z.string().min(1).max(256),
    category: CategoryString,
    price_cents: z.number().int().min(1).max(5_000_000), // $0.01 to $50,000 per item
    qty: z.number().int().min(1).max(1000),
  })
  .strict()
  .refine(
    (item) => Number.isSafeInteger(item.price_cents * item.qty),
    { message: "price_cents * qty must be a safe integer" }
  );

export type CartItem = z.infer<typeof CartItemSchema>;

// -----------------------------------------------------------------------------
// Action request
// -----------------------------------------------------------------------------

export const ActionRequestSchema = z
  .object({
    request_id: z.string().min(8).max(128),
    ts: z.string().datetime(),
    agent_id: z.string().min(3).max(128),
    agent_pubkey: Ed25519PubkeySchema,
    action: z.literal("spend"),
    vendor: VendorString,
    currency: z.literal("USD"),
    cart: z.array(CartItemSchema).min(1).max(100),
  })
  .strict()
  .superRefine((req, ctx) => {
    // Calculate total and validate bounds
    let total = 0;
    for (const item of req.cart) {
      const lineTotal = item.price_cents * item.qty;
      total += lineTotal;
      if (!Number.isSafeInteger(total)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cart"],
          message: "cart total exceeds safe integer bounds",
        });
        return;
      }
    }

    if (total <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cart"],
        message: "cart total must be greater than zero",
      });
    }
  });

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

// -----------------------------------------------------------------------------
// Action result
// -----------------------------------------------------------------------------

export const ActionResultSchema = z
  .object({
    request_id: z.string().min(8).max(128),
    decision: z.enum(["allow", "deny"]),
    reason: ReasonSchema,
    receipt_id: z.string().min(8).max(128),
  })
  .strict();

export type ActionResult = z.infer<typeof ActionResultSchema>;
