import { describe, it, expect } from "vitest";
import {
  CapNetError,
  DeniedError,
  CategoryBlockedError,
  BudgetExceededError,
  RevokedCapabilityError,
  ToolNotAllowedError,
  ExecutorMismatchError,
  ExpiredCapabilityError,
  classifyDenialError,
} from "../../sdk/src/errors.js";
import type { ActionResult } from "@capnet-auth/shared";

function makeResult(reason: string): ActionResult {
  return {
    request_id: "req_test_12345678",
    decision: "deny",
    reason,
    receipt_id: "rcpt_test_12345678",
  };
}

describe("classifyDenialError", () => {
  it("maps CATEGORY_BLOCKED:* to CategoryBlockedError", () => {
    const err = classifyDenialError(makeResult("CATEGORY_BLOCKED:alcohol"));
    expect(err).toBeInstanceOf(CategoryBlockedError);
    expect(err).toBeInstanceOf(DeniedError);
    expect(err).toBeInstanceOf(CapNetError);
    expect((err as CategoryBlockedError).category).toBe("alcohol");
  });

  it("maps TOOL_CATEGORY_BLOCKED:* to CategoryBlockedError", () => {
    const err = classifyDenialError(makeResult("TOOL_CATEGORY_BLOCKED:shell"));
    expect(err).toBeInstanceOf(CategoryBlockedError);
    expect((err as CategoryBlockedError).category).toBe("shell");
  });

  it("maps AMOUNT_EXCEEDS_MAX to BudgetExceededError", () => {
    const err = classifyDenialError(makeResult("AMOUNT_EXCEEDS_MAX"), {
      requestedCents: 5000,
      maxCents: 1000,
    });
    expect(err).toBeInstanceOf(BudgetExceededError);
    const be = err as BudgetExceededError;
    expect(be.requestedCents).toBe(5000);
    expect(be.maxCents).toBe(1000);
  });

  it("maps REVOKED to RevokedCapabilityError", () => {
    const err = classifyDenialError(makeResult("REVOKED"));
    expect(err).toBeInstanceOf(RevokedCapabilityError);
  });

  it("maps PARENT_REVOKED to RevokedCapabilityError", () => {
    const err = classifyDenialError(makeResult("PARENT_REVOKED"));
    expect(err).toBeInstanceOf(RevokedCapabilityError);
  });

  it("maps TOOL_NOT_ALLOWED to ToolNotAllowedError", () => {
    const err = classifyDenialError(makeResult("TOOL_NOT_ALLOWED"), {
      tool: "exec_bash",
    });
    expect(err).toBeInstanceOf(ToolNotAllowedError);
    expect((err as ToolNotAllowedError).tool).toBe("exec_bash");
  });

  it("maps EXECUTOR_MISMATCH to ExecutorMismatchError", () => {
    const err = classifyDenialError(makeResult("EXECUTOR_MISMATCH"));
    expect(err).toBeInstanceOf(ExecutorMismatchError);
  });

  it("maps CAP_EXPIRED to ExpiredCapabilityError", () => {
    const err = classifyDenialError(makeResult("CAP_EXPIRED"));
    expect(err).toBeInstanceOf(ExpiredCapabilityError);
  });

  it("maps PARENT_EXPIRED to ExpiredCapabilityError", () => {
    const err = classifyDenialError(makeResult("PARENT_EXPIRED"));
    expect(err).toBeInstanceOf(ExpiredCapabilityError);
  });

  it("maps CAP_NOT_YET_VALID to ExpiredCapabilityError", () => {
    const err = classifyDenialError(makeResult("CAP_NOT_YET_VALID"));
    expect(err).toBeInstanceOf(ExpiredCapabilityError);
  });

  it("falls back to DeniedError for unknown reasons", () => {
    const err = classifyDenialError(makeResult("NO_CAPABILITY"));
    expect(err).toBeInstanceOf(DeniedError);
    expect(err).not.toBeInstanceOf(CategoryBlockedError);
    expect(err).not.toBeInstanceOf(BudgetExceededError);
  });

  it("preserves receiptId on all errors", () => {
    const err = classifyDenialError(makeResult("REVOKED"));
    expect(err.receiptId).toBe("rcpt_test_12345678");
  });
});

describe("error instanceof chain", () => {
  it("DeniedError extends CapNetError extends Error", () => {
    const err = new DeniedError("TEST", "rcpt_1234");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CapNetError);
    expect(err).toBeInstanceOf(DeniedError);
  });

  it("CategoryBlockedError extends DeniedError", () => {
    const err = new CategoryBlockedError("CATEGORY_BLOCKED:x", "rcpt_1234", "x");
    expect(err).toBeInstanceOf(DeniedError);
    expect(err).toBeInstanceOf(CapNetError);
  });
});
