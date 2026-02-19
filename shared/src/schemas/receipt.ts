import { z } from "zod";

/** Receipt schema — protocol-grade audit layer */

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

/** Ed25519 signature: base64, decodes to 64 bytes */
const Ed25519SigSchema = Base64Schema.refine(
  (b64) => {
    try {
      const len = Math.floor((b64.replace(/=/g, "").length * 3) / 4);
      return len === 64;
    } catch {
      return false;
    }
  },
  { message: "must be 64-byte Ed25519 signature (base64)" }
);

/** Normalized vendor string: trimmed, lowercase, bounded */
const VendorString = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .transform((s) => s.toLowerCase());

// -----------------------------------------------------------------------------
// JSON-safe meta value (no functions, Dates, Buffers, circular refs)
// -----------------------------------------------------------------------------

const JsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitive, z.array(JsonValueSchema), z.record(JsonValueSchema)])
);

// -----------------------------------------------------------------------------
// Receipt event types
// -----------------------------------------------------------------------------

export const ReceiptEventSchema = z.enum([
  "ACTION_ATTEMPT",
  "ACTION_ALLOWED",
  "ACTION_DENIED",
  "CAP_ISSUED",
  "CAP_REVOKED",
]);

export type ReceiptEvent = z.infer<typeof ReceiptEventSchema>;

// -----------------------------------------------------------------------------
// Receipt summary (strict, predictable for UI)
// -----------------------------------------------------------------------------

const ReceiptSummarySchema = z
  .object({
    amount_cents: z.number().int().nonnegative().optional(),
    item_count: z.number().int().nonnegative().optional(),
    denied_reason: z.string().max(256).optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Receipt proof (optional, for signed receipts)
// -----------------------------------------------------------------------------

const ReceiptProofSchema = z
  .object({
    alg: z.literal("ed25519"),
    sig: Ed25519SigSchema,
    signer_pubkey: Ed25519PubkeySchema,
  })
  .strict();

// -----------------------------------------------------------------------------
// Receipt schema with event-driven required fields
// -----------------------------------------------------------------------------

export const ReceiptSchema = z
  .object({
    receipt_id: z.string().min(8).max(128),
    ts: z.string().datetime(),
    event: ReceiptEventSchema,
    cap_id: z.string().min(8).max(128).optional(),
    request_id: z.string().min(8).max(128).optional(),
    agent_id: z.string().min(3).max(128).optional(),
    vendor: VendorString.optional(),
    summary: ReceiptSummarySchema.default({}),
    meta: z.record(JsonValueSchema).default({}),
    proof: ReceiptProofSchema.optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    // Validate timestamp is parseable and not absurdly far in future
    const ts = Date.parse(r.ts);
    if (!Number.isFinite(ts)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ts"],
        message: "ts must be a valid parseable datetime",
      });
    } else {
      // Reject timestamps more than 1 day in future (clock drift protection)
      const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000;
      if (ts > oneDayFromNow) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ts"],
          message: "ts is too far in the future",
        });
      }
    }

    // Event-driven required fields
    if (r.event === "CAP_ISSUED" && !r.cap_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cap_id"],
        message: "cap_id is required for CAP_ISSUED event",
      });
    }

    if (r.event === "CAP_REVOKED" && !r.cap_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cap_id"],
        message: "cap_id is required for CAP_REVOKED event",
      });
    }

    // ACTION_* events require request_id and agent_id
    if (r.event.startsWith("ACTION_")) {
      if (!r.request_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["request_id"],
          message: `request_id is required for ${r.event} event`,
        });
      }
      if (!r.agent_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["agent_id"],
          message: `agent_id is required for ${r.event} event`,
        });
      }
    }

    // ACTION_ALLOWED should have cap_id (the matched capability)
    if (r.event === "ACTION_ALLOWED" && !r.cap_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cap_id"],
        message: "cap_id is required for ACTION_ALLOWED event",
      });
    }
  });

export type Receipt = z.infer<typeof ReceiptSchema>;
