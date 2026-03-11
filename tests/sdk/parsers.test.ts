import { describe, it, expect } from "vitest";
import { parseBudget, parseDuration, durationToExpiry } from "../../sdk/src/parsers.js";

describe("parseBudget", () => {
  it("parses integer USD", () => {
    expect(parseBudget("100 USD")).toEqual({ cents: 10000, currency: "USD" });
  });

  it("parses decimal USD", () => {
    expect(parseBudget("49.99 USD")).toEqual({ cents: 4999, currency: "USD" });
  });

  it("parses single decimal place", () => {
    expect(parseBudget("5.5 USD")).toEqual({ cents: 550, currency: "USD" });
  });

  it("is case-insensitive for currency", () => {
    expect(parseBudget("10 usd")).toEqual({ cents: 1000, currency: "USD" });
  });

  it("throws on missing currency", () => {
    expect(() => parseBudget("100")).toThrow("Invalid budget format");
  });

  it("throws on unsupported currency", () => {
    expect(() => parseBudget("100 EUR")).toThrow("Invalid budget format");
  });

  it("throws on negative amount", () => {
    expect(() => parseBudget("-10 USD")).toThrow("Invalid budget format");
  });

  it("throws on zero", () => {
    expect(() => parseBudget("0 USD")).toThrow("Budget must be greater than zero");
  });

  it("throws on empty string", () => {
    expect(() => parseBudget("")).toThrow("Invalid budget format");
  });

  it("throws on too many decimal places", () => {
    expect(() => parseBudget("10.999 USD")).toThrow("Invalid budget format");
  });
});

describe("parseDuration", () => {
  it("parses minutes", () => {
    expect(parseDuration("30m")).toBe(30 * 60 * 1000);
  });

  it("parses hours", () => {
    expect(parseDuration("2h")).toBe(2 * 60 * 60 * 1000);
  });

  it("parses days", () => {
    expect(parseDuration("1d")).toBe(24 * 60 * 60 * 1000);
  });

  it("throws on invalid format", () => {
    expect(() => parseDuration("30s")).toThrow("Invalid duration format");
  });

  it("throws on empty string", () => {
    expect(() => parseDuration("")).toThrow("Invalid duration format");
  });

  it("throws on no unit", () => {
    expect(() => parseDuration("30")).toThrow("Invalid duration format");
  });
});

describe("durationToExpiry", () => {
  it("returns an ISO timestamp in the future", () => {
    const before = Date.now();
    const result = durationToExpiry("1h");
    const after = Date.now();

    const ts = new Date(result).getTime();
    const oneHour = 60 * 60 * 1000;

    expect(ts).toBeGreaterThanOrEqual(before + oneHour);
    expect(ts).toBeLessThanOrEqual(after + oneHour);
  });

  it("returns valid ISO string", () => {
    const result = durationToExpiry("30m");
    expect(() => new Date(result).toISOString()).not.toThrow();
  });
});
