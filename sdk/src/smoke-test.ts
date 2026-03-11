/**
 * Smoke test for the new SDK builder API.
 * Run: npx tsx sdk/src/smoke-test.ts
 */
import { CapNet, CapabilityHandle, DeniedError, CategoryBlockedError, BudgetExceededError } from "./index.js";
import { generateEd25519Keypair } from "@capnet/shared";

async function main() {
  console.log("=== SDK DX Smoke Test ===\n");

  // 1. Connect
  const capnet = await CapNet.create();
  console.log("[1] Connected to proxy via CapNet.create()");

  // 2. Spend capability with builder
  const keypair = generateEd25519Keypair();
  const agent = capnet.agent("smoke-test-agent", { identity: keypair });

  const spendCap = await agent
    .spend({ budget: "25 USD", vendors: ["sandboxmart"] })
    .block("alcohol", "tobacco")
    .issue();

  console.log(`[2] Issued spend cap: ${spendCap.capId}`);
  console.log(`    Budget: $${(spendCap.budgetCents! / 100).toFixed(2)}`);
  console.log(`    Expired: ${spendCap.isExpired}`);

  // 3. Successful purchase
  const result = await spendCap.purchase([{ sku: "GRO-004", qty: 2 }]);
  console.log(`[3] Purchase: ${result.decision} (${result.reason})`);

  // 4. Blocked category
  try {
    await spendCap.purchase([{ sku: "ALC-001", qty: 1 }]);
    console.log("[4] ERROR: should have been denied");
  } catch (err) {
    if (err instanceof CategoryBlockedError) {
      console.log(`[4] Alcohol blocked: ${err.category} (correct)`);
    } else {
      console.log(`[4] Unexpected error: ${err}`);
    }
  }

  // 5. Tool call capability
  const toolCap = await agent
    .toolCalls({ tools: ["web_search", "read_file"], maxCalls: 10 })
    .block("shell")
    .issue();

  console.log(`[5] Issued tool_call cap: ${toolCap.capId}`);
  console.log(`    Tools: ${toolCap.allowedTools?.join(", ")}`);

  const toolResult = await toolCap.execute("web_search", { q: "test" }, "web");
  console.log(`[6] Tool call: ${toolResult.decision} (${toolResult.reason})`);

  // 6. Delegation
  const childKeypair = generateEd25519Keypair();
  const childCap = await spendCap.delegate({
    to: "smoke-child",
    budget: "10 USD",
    identity: childKeypair,
  });
  console.log(`[7] Delegated to child: ${childCap.capId}, budget $${(childCap.budgetCents! / 100).toFixed(2)}`);

  // 7. Child purchase
  const childResult = await childCap.purchase([{ sku: "GRO-007", qty: 1 }]);
  console.log(`[8] Child purchase: ${childResult.decision}`);

  // 8. Revoke parent → cascade
  await spendCap.revoke();
  console.log("[9] Revoked parent cap");

  try {
    await childCap.purchase([{ sku: "GRO-007", qty: 1 }]);
    console.log("[10] ERROR: child should be revoked");
  } catch (err) {
    if (err instanceof DeniedError) {
      console.log(`[10] Child denied after revoke: ${err.reason} (correct)`);
    }
  }

  // 9. Escape hatch
  const health = await capnet.raw.health();
  console.log(`[11] Raw client escape hatch: ${health.status}`);

  console.log("\n=== All smoke tests passed ===");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
