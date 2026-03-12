import type { ActionResult } from "@capnet-auth/shared";

export class CapNetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapNetError";
  }
}

export class DeniedError extends CapNetError {
  readonly reason: string;
  readonly receiptId: string;

  constructor(reason: string, receiptId: string, message?: string) {
    super(message ?? `Action denied: ${reason}`);
    this.name = "DeniedError";
    this.reason = reason;
    this.receiptId = receiptId;
  }
}

export class CategoryBlockedError extends DeniedError {
  readonly category: string;

  constructor(reason: string, receiptId: string, category: string) {
    super(reason, receiptId, `Category blocked: ${category}`);
    this.name = "CategoryBlockedError";
    this.category = category;
  }
}

export class BudgetExceededError extends DeniedError {
  readonly requestedCents: number | undefined;
  readonly maxCents: number | undefined;

  constructor(
    reason: string,
    receiptId: string,
    requestedCents?: number,
    maxCents?: number
  ) {
    const detail =
      requestedCents != null && maxCents != null
        ? ` (requested ${requestedCents}, max ${maxCents})`
        : "";
    super(reason, receiptId, `Budget exceeded${detail}`);
    this.name = "BudgetExceededError";
    this.requestedCents = requestedCents;
    this.maxCents = maxCents;
  }
}

export class RevokedCapabilityError extends DeniedError {
  constructor(reason: string, receiptId: string) {
    super(reason, receiptId, "Capability has been revoked");
    this.name = "RevokedCapabilityError";
  }
}

export class ToolNotAllowedError extends DeniedError {
  readonly tool: string | undefined;

  constructor(reason: string, receiptId: string, tool?: string) {
    super(reason, receiptId, tool ? `Tool not allowed: ${tool}` : "Tool not allowed");
    this.name = "ToolNotAllowedError";
    this.tool = tool;
  }
}

export class ExecutorMismatchError extends DeniedError {
  constructor(reason: string, receiptId: string) {
    super(reason, receiptId, "Executor does not match capability");
    this.name = "ExecutorMismatchError";
  }
}

export class ExpiredCapabilityError extends DeniedError {
  constructor(reason: string, receiptId: string) {
    super(reason, receiptId, "Capability has expired or is not yet valid");
    this.name = "ExpiredCapabilityError";
  }
}

export interface ClassifyContext {
  requestedCents?: number;
  maxCents?: number;
  tool?: string;
}

export function classifyDenialError(
  result: ActionResult,
  context?: ClassifyContext
): DeniedError {
  const { reason, receipt_id } = result;

  if (typeof reason === "string" && reason.startsWith("CATEGORY_BLOCKED:")) {
    const category = reason.slice("CATEGORY_BLOCKED:".length);
    return new CategoryBlockedError(reason, receipt_id, category);
  }

  if (typeof reason === "string" && reason.startsWith("TOOL_CATEGORY_BLOCKED:")) {
    const category = reason.slice("TOOL_CATEGORY_BLOCKED:".length);
    return new CategoryBlockedError(reason, receipt_id, category);
  }

  switch (reason) {
    case "AMOUNT_EXCEEDS_MAX":
      return new BudgetExceededError(
        reason,
        receipt_id,
        context?.requestedCents,
        context?.maxCents
      );

    case "REVOKED":
    case "PARENT_REVOKED":
      return new RevokedCapabilityError(reason, receipt_id);

    case "TOOL_NOT_ALLOWED":
      return new ToolNotAllowedError(reason, receipt_id, context?.tool);

    case "EXECUTOR_MISMATCH":
      return new ExecutorMismatchError(reason, receipt_id);

    case "CAP_EXPIRED":
    case "PARENT_EXPIRED":
    case "CAP_NOT_YET_VALID":
      return new ExpiredCapabilityError(reason, receipt_id);

    default:
      return new DeniedError(reason, receipt_id);
  }
}
