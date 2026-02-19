import { z } from "zod";

/** CapDoc v0.1 — canonical schema (protocol-grade) */

// -----------------------------------------------------------------------------
// Shared validators
// -----------------------------------------------------------------------------

/** Base64 format validator (lightweight, no decode) */
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

// -----------------------------------------------------------------------------
// Sub-schemas (strict to reject extra fields)
// -----------------------------------------------------------------------------

export const IssuerSchema = z
  .object({
    id: z.string().min(3).max(128),
    pubkey: Ed25519PubkeySchema,
  })
  .strict();

export const SubjectSchema = z
  .object({
    id: z.string().min(3).max(128),
  })
  .strict();

export const ExecutorSchema = z
  .object({
    agent_id: z.string().min(3).max(128),
    agent_pubkey: Ed25519PubkeySchema,
  })
  .strict();

export const ResourceSchema = z
  .object({
    type: z.enum(["spend", "sandbox_merchant", "generic"]),
    vendor: z.string().min(2).max(128),
  })
  .strict();

export const ConstraintsSchema = z
  .object({
    currency: z.literal("USD"),
    max_amount_cents: z.number().int().positive(),
    allowed_vendors: z.array(z.string().min(2).max(128)).min(1),
    blocked_categories: z.array(z.string().max(64)),
  })
  .strict();

export const RevocationSchema = z
  .object({
    mode: z.enum(["strict", "lease", "one_time"]),
    oracle: z.literal("local_proxy"),
  })
  .strict();

export const ProofSchema = z
  .object({
    alg: z.literal("ed25519"),
    sig: Ed25519SigSchema,
  })
  .strict();

// -----------------------------------------------------------------------------
// CapDoc schema with cross-field validation
// -----------------------------------------------------------------------------

export const CapDocSchema = z
  .object({
    version: z.literal("capdoc/0.1"),
    cap_id: z.string().min(8).max(128),
    issued_at: z.string().datetime(),
    not_before: z.string().datetime().optional(),
    expires_at: z.string().datetime(),
    issuer: IssuerSchema,
    subject: SubjectSchema,
    executor: ExecutorSchema,
    resource: ResourceSchema,
    actions: z.array(z.enum(["spend"])).min(1).max(10),
    constraints: ConstraintsSchema,
    revocation: RevocationSchema,
    proof: ProofSchema,
  })
  .strict()
  .superRefine((cap, ctx) => {
    const issued = Date.parse(cap.issued_at);
    const exp = Date.parse(cap.expires_at);

    // expires_at must be after issued_at
    if (!(exp > issued)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expires_at"],
        message: "expires_at must be after issued_at",
      });
    }

    // not_before must be <= expires_at
    if (cap.not_before) {
      const nb = Date.parse(cap.not_before);
      if (!(nb <= exp)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["not_before"],
          message: "not_before must be <= expires_at",
        });
      }
    }

    // allowed_vendors must include resource.vendor
    if (!cap.constraints.allowed_vendors.includes(cap.resource.vendor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["constraints", "allowed_vendors"],
        message: "allowed_vendors must include resource.vendor",
      });
    }
  });

export type CapDoc = z.infer<typeof CapDocSchema>;
