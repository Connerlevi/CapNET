import { describe, it, expect, beforeAll } from "vitest";
import { CapNet } from "../../sdk/src/capnet.js";
import { CapabilityHandle } from "../../sdk/src/handle.js";
import {
  DeniedError,
  CategoryBlockedError,
  BudgetExceededError,
  RevokedCapabilityError,
  ToolNotAllowedError,
} from "../../sdk/src/errors.js";
import { generateEd25519Keypair } from "@capnet/shared";

const PROXY_URL = process.env.PROXY_URL || "http://127.0.0.1:3100";
const SANDBOX_URL = process.env.SANDBOX_URL || "http://127.0.0.1:3200";

describe("SDK Builder Integration", () => {
  let capnet: CapNet;

  beforeAll(async () => {
    capnet = await CapNet.create({ proxy: PROXY_URL, sandbox: SANDBOX_URL });
  });

  describe("CapNet.create", () => {
    it("connects to proxy and returns CapNet instance", () => {
      expect(capnet).toBeInstanceOf(CapNet);
    });

    it("exposes raw CapNetClient", () => {
      expect(capnet.raw).toBeDefined();
      expect(typeof capnet.raw.health).toBe("function");
    });

    it("fails on unreachable proxy", async () => {
      await expect(
        CapNet.create({ proxy: "http://127.0.0.1:19999" })
      ).rejects.toThrow("Cannot connect to CapNet proxy");
    });
  });

  describe("spend capability lifecycle", () => {
    it("issues, purchases, and revokes", async () => {
      const keypair = generateEd25519Keypair();
      const agent = capnet.agent("builder-spend-test", { identity: keypair });

      const cap = await agent
        .spend({ budget: "50 USD", vendors: ["sandboxmart"] })
        .issue();

      expect(cap).toBeInstanceOf(CapabilityHandle);
      expect(cap.capId).toBeTruthy();
      expect(cap.budgetCents).toBe(5000);
      expect(cap.isExpired).toBe(false);

      // Purchase via sandbox (GRO-004: Organic Bananas, $1.99)
      const result = await cap.purchase([{ sku: "GRO-004", qty: 1 }]);
      expect(result.decision).toBe("allow");

      // Revoke
      await cap.revoke();
    });

    it("blocks categories", async () => {
      const keypair = generateEd25519Keypair();
      const agent = capnet.agent("builder-block-test", { identity: keypair });

      const cap = await agent
        .spend({ budget: "50 USD", vendors: ["sandboxmart"] })
        .block("alcohol")
        .issue();

      // Try to buy alcohol (ALC-002: Craft Beer) — should be denied
      try {
        await cap.purchase([{ sku: "ALC-002", qty: 1 }]);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CategoryBlockedError);
        expect((err as CategoryBlockedError).category).toBe("alcohol");
      }

      await cap.revoke();
    });

    it("denies over-budget purchase", async () => {
      const keypair = generateEd25519Keypair();
      const agent = capnet.agent("builder-budget-test", { identity: keypair });

      // $1 budget
      const cap = await agent
        .spend({ budget: "1 USD", vendors: ["sandboxmart"] })
        .issue();

      try {
        // GRO-006: Chicken Breast $8.99 — over $1 budget
        await cap.purchase([{ sku: "GRO-006", qty: 1 }]);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BudgetExceededError);
      }

      await cap.revoke();
    });
  });

  describe("tool_call capability lifecycle", () => {
    it("issues and executes tool calls", async () => {
      const keypair = generateEd25519Keypair();
      const agent = capnet.agent("builder-tool-test", { identity: keypair });

      const cap = await agent
        .toolCalls({ tools: ["web_search", "read_file"] })
        .issue();

      expect(cap).toBeInstanceOf(CapabilityHandle);
      expect(cap.allowedTools).toEqual(["web_search", "read_file"]);

      const result = await cap.execute("web_search", { query: "test" }, "web");
      expect(result.decision).toBe("allow");

      await cap.revoke();
    });

    it("denies unlisted tool", async () => {
      const keypair = generateEd25519Keypair();
      const agent = capnet.agent("builder-tool-deny-test", { identity: keypair });

      const cap = await agent
        .toolCalls({ tools: ["read_file"] })
        .issue();

      try {
        await cap.execute("exec_bash", {}, "shell");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ToolNotAllowedError);
      }

      await cap.revoke();
    });

    it("blocks tool categories", async () => {
      const keypair = generateEd25519Keypair();
      const agent = capnet.agent("builder-toolcat-test", { identity: keypair });

      const cap = await agent
        .toolCalls({ tools: ["exec_bash"] })
        .block("shell")
        .issue();

      try {
        await cap.execute("exec_bash", {}, "shell");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CategoryBlockedError);
      }

      await cap.revoke();
    });
  });

  describe("delegation", () => {
    it("delegates a spend capability to a sub-agent", async () => {
      const parentKeypair = generateEd25519Keypair();
      const childKeypair = generateEd25519Keypair();
      const agent = capnet.agent("builder-parent", { identity: parentKeypair });

      const parentCap = await agent
        .spend({ budget: "100 USD", vendors: ["sandboxmart"] })
        .issue();

      const childCap = await parentCap.delegate({
        to: "builder-child",
        budget: "20 USD",
        identity: childKeypair,
      });

      expect(childCap).toBeInstanceOf(CapabilityHandle);
      expect(childCap.budgetCents).toBe(2000);

      // Child can purchase (GRO-004: Organic Bananas, $1.99)
      const result = await childCap.purchase([{ sku: "GRO-004", qty: 1 }]);
      expect(result.decision).toBe("allow");

      // Revoke parent (cascades)
      await parentCap.revoke();

      // Child should be revoked
      try {
        await childCap.purchase([{ sku: "GRO-004", qty: 1 }]);
        expect.fail("Should have thrown after parent revocation");
      } catch (err) {
        expect(err).toBeInstanceOf(RevokedCapabilityError);
      }
    });
  });
});
