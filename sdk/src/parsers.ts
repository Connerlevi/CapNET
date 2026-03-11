export interface ParsedBudget {
  cents: number;
  currency: "USD";
}

export function parseBudget(input: string): ParsedBudget {
  const match = input.match(/^(\d+(?:\.\d{1,2})?)\s+(USD)$/i);
  if (!match) {
    throw new Error(
      `Invalid budget format: "${input}". Expected format: "100 USD" or "49.99 USD"`
    );
  }
  const [, amount, currency] = match;
  const cents = Math.round(parseFloat(amount!) * 100);
  if (cents <= 0) {
    throw new Error(`Budget must be greater than zero: "${input}"`);
  }
  return { cents, currency: currency!.toUpperCase() as "USD" };
}

export function parseDuration(input: string): number {
  const match = input.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    throw new Error(
      `Invalid duration format: "${input}". Expected format: "30m", "2h", or "1d"`
    );
  }
  const [, value, unit] = match;
  const n = parseInt(value!, 10);
  switch (unit) {
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: "${unit}"`);
  }
}

export function durationToExpiry(input: string): string {
  const ms = parseDuration(input);
  return new Date(Date.now() + ms).toISOString();
}
