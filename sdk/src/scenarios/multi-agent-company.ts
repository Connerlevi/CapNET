/**
 * Scenario 3: The Multi-Agent Company
 *
 * Story: Acme Corp deploys three AI agents — Sales, Finance, Engineering.
 * Each has a scoped capability matching their role. Without CapNet every
 * agent has the company credit card and root SSH access. With CapNet,
 * role isolation, delegation, and cascade revocation keep things safe.
 *
 * Demonstrates: multiple agents with different capability types,
 * cross-boundary denials, delegation + attenuation, cascade revocation.
 */

import {
  generateEd25519Keypair,
  fetchJson,
  logStep,
  logHeader,
  logDecision,
  die,
  checkProxy,
  checkSandbox,
  makeRequestId,
  printAuditTrail,
  pause,
  PROXY_URL,
  SANDBOX_URL,
  type CapDoc,
  type ActionResult,
  type CatalogResponse,
  type CartValidateResponse,
  type CheckoutResponse,
} from "../demo-utils";

const SALES_ID = "agent:acme-sales";
const FINANCE_ID = "agent:acme-finance";
const ENGINEERING_ID = "agent:acme-engineering";
const JUNIOR_SALES_ID = "agent:acme-junior-sales";

export async function main() {
  logHeader("Scenario 3: The Multi-Agent Company");

  // -----------------------------------------------------------------------
  // Step 1 — Set the scene
  // -----------------------------------------------------------------------
  logStep(1, "WITHOUT CapNet — what goes wrong");
  console.log(`
    Acme Corp gives all three AI agents the same credentials:
      - Company credit card (no limit)
      - AWS root access
      - GitHub admin token
      - Slack bot token

    What happens:
      - Sales agent buys $50K in "client gifts" (gift cards for itself)
      - Finance agent accidentally deploys untested code to production
      - Engineering agent expenses a $3K dinner "for the team"
      - Junior intern's agent (delegated by Sales) buys alcohol

    Total chaos: $53K in unauthorized spend, a production outage,
    and an HR incident. Every agent could do everything.
`);
  await pause(3000);

  // -----------------------------------------------------------------------
  // Step 2 — Health checks
  // -----------------------------------------------------------------------
  logStep(2, "WITH CapNet — checking services...");
  await checkProxy();
  await checkSandbox();

  // -----------------------------------------------------------------------
  // Step 3 — Generate 3 agent keypairs
  // -----------------------------------------------------------------------
  logStep(3, "Generating agent identities...");
  const salesKey = generateEd25519Keypair();
  const financeKey = generateEd25519Keypair();
  const engineeringKey = generateEd25519Keypair();

  console.log(`    Sales:       ${SALES_ID}`);
  console.log(`    Finance:     ${FINANCE_ID}`);
  console.log(`    Engineering: ${ENGINEERING_ID}`);

  // -----------------------------------------------------------------------
  // Step 4 — Issue SPEND cap to Sales ($100, blocked: alcohol/tobacco)
  // -----------------------------------------------------------------------
  logStep(4, "Issuing SPEND capability to Sales ($100)...");
  let salesCap: CapDoc;
  try {
    salesCap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "sales",
        agent_id: SALES_ID,
        agent_pubkey: salesKey.publicKeyB64,
        constraints: {
          max_amount_cents: 10000, // $100
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol", "tobacco"],
        },
      }),
    });
  } catch (err) {
    die(`Failed to issue Sales cap: ${err instanceof Error ? err.message : err}`);
  }
  const sc = salesCap.constraints as { max_amount_cents: number; blocked_categories: string[] };
  console.log(`    Cap ID:  ${salesCap.cap_id}`);
  console.log(`    Budget:  $${(sc.max_amount_cents / 100).toFixed(2)}`);
  console.log(`    Blocked: ${sc.blocked_categories.join(", ")}`);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 5 — Issue SPEND cap to Finance ($500, blocked: alcohol/tobacco/gift_cards)
  // -----------------------------------------------------------------------
  logStep(5, "Issuing SPEND capability to Finance ($500)...");
  let financeCap: CapDoc;
  try {
    financeCap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "finance",
        agent_id: FINANCE_ID,
        agent_pubkey: financeKey.publicKeyB64,
        constraints: {
          max_amount_cents: 50000, // $500
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol", "tobacco", "gift_cards"],
        },
      }),
    });
  } catch (err) {
    die(`Failed to issue Finance cap: ${err instanceof Error ? err.message : err}`);
  }
  const fc = financeCap.constraints as { max_amount_cents: number; blocked_categories: string[] };
  console.log(`    Cap ID:  ${financeCap.cap_id}`);
  console.log(`    Budget:  $${(fc.max_amount_cents / 100).toFixed(2)}`);
  console.log(`    Blocked: ${fc.blocked_categories.join(", ")}`);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 6 — Issue TOOL_CALL cap to Engineering
  // -----------------------------------------------------------------------
  logStep(6, "Issuing TOOL_CALL capability to Engineering...");
  let engCap: CapDoc;
  try {
    engCap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/issue/toolcall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "engineering",
        agent_id: ENGINEERING_ID,
        agent_pubkey: engineeringKey.publicKeyB64,
        constraints: {
          allowed_tools: [
            "deploy_staging",
            "run_tests",
            "read_logs",
            "create_pr",
          ],
          blocked_tool_categories: ["shell", "spawn", "device"],
        },
      }),
    });
  } catch (err) {
    die(`Failed to issue Engineering cap: ${err instanceof Error ? err.message : err}`);
  }
  const ec = engCap.constraints as { allowed_tools: string[]; blocked_tool_categories: string[] };
  console.log(`    Cap ID:  ${engCap.cap_id}`);
  console.log(`    Tools:   ${ec.allowed_tools.join(", ")}`);
  console.log(`    Blocked: ${ec.blocked_tool_categories.join(", ")}`);
  await pause(2000);

  // Fetch catalog
  const catalog = await fetchJson<CatalogResponse>(`${SANDBOX_URL}/catalog`);

  // -----------------------------------------------------------------------
  // Step 7 — Sales buys client supplies (ALLOWED)
  // -----------------------------------------------------------------------
  logStep(7, "Sales buys client meeting supplies (should be ALLOWED)...");
  const salesCart = [
    { sku: "GRO-002", qty: 2 }, // Bread
    { sku: "GRO-005", qty: 1 }, // Greek Yogurt
  ];

  console.log("    Cart:");
  for (const c of salesCart) {
    const item = catalog.items.find((i) => i.sku === c.sku);
    console.log(`      - ${c.qty}x ${item?.name} ($${((item?.price_cents ?? 0) / 100).toFixed(2)} ea)`);
  }

  const salesValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: SALES_ID,
        agent_pubkey: salesKey.publicKeyB64,
        cart: salesCart,
      }),
    },
  );
  console.log(`    Total: $${(salesValidation.total_cents / 100).toFixed(2)}`);

  const salesResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/request`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(salesValidation.action_request),
    },
  );
  logDecision(salesResult);

  if (salesResult.decision === "allow") {
    const order = await fetchJson<CheckoutResponse>(`${SANDBOX_URL}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: salesResult.request_id,
        receipt_id: salesResult.receipt_id,
        cart: salesCart,
      }),
    });
    console.log(`    Order: ${order.order.order_id} ✓`);
  }
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 8 — Engineering deploys staging (ALLOWED)
  // -----------------------------------------------------------------------
  logStep(8, "Engineering deploys to staging (should be ALLOWED)...");
  const deployResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/toolcall`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: makeRequestId(),
        ts: new Date().toISOString(),
        agent_id: ENGINEERING_ID,
        agent_pubkey: engineeringKey.publicKeyB64,
        action: "tool_call",
        tool_name: "deploy_staging",
        tool_category: "web",
        tool_input: { branch: "main", env: "staging" },
      }),
    },
  );
  logDecision(deployResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 9 — Finance tries to deploy code (DENIED — wrong cap type)
  // -----------------------------------------------------------------------
  logStep(9, "Finance tries to deploy code (should be DENIED)...");
  console.log("    Finance has a SPEND cap, not a TOOL_CALL cap");
  const financeDeployResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/toolcall`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: makeRequestId(),
        ts: new Date().toISOString(),
        agent_id: FINANCE_ID,
        agent_pubkey: financeKey.publicKeyB64,
        action: "tool_call",
        tool_name: "deploy_staging",
        tool_category: "web",
        tool_input: { branch: "main", env: "production" },
      }),
    },
  );
  logDecision(financeDeployResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 10 — Engineering tries to spend money (DENIED — wrong cap type)
  // -----------------------------------------------------------------------
  logStep(10, "Engineering tries to buy supplies (should be DENIED)...");
  console.log("    Engineering has a TOOL_CALL cap, not a SPEND cap");
  const engCart = [{ sku: "GRO-001", qty: 1 }];
  const engValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: ENGINEERING_ID,
        agent_pubkey: engineeringKey.publicKeyB64,
        cart: engCart,
      }),
    },
  );
  const engSpendResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/request`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(engValidation.action_request),
    },
  );
  logDecision(engSpendResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 11 — Sales delegates to Junior Sales ($30, +gift_cards blocked)
  // -----------------------------------------------------------------------
  logStep(11, "Sales delegates to Junior Sales ($30, +gift_cards blocked)...");
  const juniorKey = generateEd25519Keypair();
  console.log(`    Junior: ${JUNIOR_SALES_ID}`);

  let juniorCap: CapDoc;
  try {
    juniorCap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_cap_id: salesCap.cap_id,
        new_executor: {
          agent_id: JUNIOR_SALES_ID,
          agent_pubkey: juniorKey.publicKeyB64,
        },
        constraints: {
          max_amount_cents: 3000, // $30 (attenuated from $100)
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol", "tobacco", "gift_cards"], // added gift_cards
        },
      }),
    });
  } catch (err) {
    die(`Failed to delegate to Junior Sales: ${err instanceof Error ? err.message : err}`);
  }
  const jc = juniorCap.constraints as { max_amount_cents: number; blocked_categories: string[] };
  console.log(`    Cap ID:  ${juniorCap.cap_id}`);
  console.log(`    Budget:  $${(jc.max_amount_cents / 100).toFixed(2)} (from Sales' $100)`);
  console.log(`    Blocked: ${jc.blocked_categories.join(", ")}`);
  console.log(`    Depth:   ${juniorCap.delegation_depth}`);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 12 — Junior Sales buys groceries (ALLOWED)
  // -----------------------------------------------------------------------
  logStep(12, "Junior Sales buys snacks for meeting (should be ALLOWED)...");
  const juniorCart = [
    { sku: "GRO-004", qty: 2 }, // Bananas
    { sku: "GRO-003", qty: 1 }, // Eggs
  ];

  console.log("    Cart:");
  for (const c of juniorCart) {
    const item = catalog.items.find((i) => i.sku === c.sku);
    console.log(`      - ${c.qty}x ${item?.name} ($${((item?.price_cents ?? 0) / 100).toFixed(2)} ea)`);
  }

  const juniorValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: JUNIOR_SALES_ID,
        agent_pubkey: juniorKey.publicKeyB64,
        cart: juniorCart,
      }),
    },
  );
  console.log(`    Total: $${(juniorValidation.total_cents / 100).toFixed(2)}`);

  const juniorResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/request`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(juniorValidation.action_request),
    },
  );
  logDecision(juniorResult);

  if (juniorResult.decision === "allow") {
    const order = await fetchJson<CheckoutResponse>(`${SANDBOX_URL}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: juniorResult.request_id,
        receipt_id: juniorResult.receipt_id,
        cart: juniorCart,
      }),
    });
    console.log(`    Order: ${order.order.order_id} ✓`);
  }
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 13 — Revoke Sales cap → cascade to Junior; verify Finance still works
  // -----------------------------------------------------------------------
  logStep(13, "Revoking Sales cap (should cascade to Junior)...");
  try {
    await fetchJson<{ success: boolean }>(`${PROXY_URL}/capability/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cap_id: salesCap.cap_id }),
    });
    console.log(`    Revoked: ${salesCap.cap_id} (Sales)`);
    console.log(`    Cascade: ${juniorCap.cap_id} (Junior Sales)`);
  } catch (err) {
    die(`Failed to revoke: ${err instanceof Error ? err.message : err}`);
  }

  // Junior Sales should now be denied
  console.log("\n    Junior Sales tries to buy after cascade revoke...");
  const postRevokeValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: JUNIOR_SALES_ID,
        agent_pubkey: juniorKey.publicKeyB64,
        cart: [{ sku: "GRO-001", qty: 1 }],
      }),
    },
  );
  const postRevokeResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/request`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postRevokeValidation.action_request),
    },
  );
  console.log("    Junior Sales:");
  logDecision(postRevokeResult);

  // Finance should still work
  console.log("\n    Finance agent should still be active...");
  const financeCart = [{ sku: "HOU-001", qty: 1 }]; // Paper Towels
  const financeValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: FINANCE_ID,
        agent_pubkey: financeKey.publicKeyB64,
        cart: financeCart,
      }),
    },
  );
  const financeSpendResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/request`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(financeValidation.action_request),
    },
  );
  console.log("    Finance:");
  logDecision(financeSpendResult);

  if (financeSpendResult.decision === "allow") {
    const order = await fetchJson<CheckoutResponse>(`${SANDBOX_URL}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: financeSpendResult.request_id,
        receipt_id: financeSpendResult.receipt_id,
        cart: financeCart,
      }),
    });
    console.log(`    Order: ${order.order.order_id} ✓`);
  }
  await pause(2500);

  // -----------------------------------------------------------------------
  // Step 14 — Audit trail + summary
  // -----------------------------------------------------------------------
  logStep(14, "Audit trail...");
  await printAuditTrail(25);
  await pause(3000);

  logHeader("Scenario 3 Summary: The Multi-Agent Company");
  console.log("  Role isolation:");
  console.log("    ✓ Sales buys supplies         ALLOWED  (spend cap, $100)");
  console.log("    ✓ Engineering deploys staging  ALLOWED  (tool_call cap)");
  console.log("    ✗ Finance deploys code         DENIED   (has spend cap, not tool_call)");
  console.log("    ✗ Engineering buys supplies    DENIED   (has tool_call cap, not spend)");
  console.log("");
  console.log("  Delegation + attenuation:");
  console.log("    ✓ Junior Sales buys snacks     ALLOWED  ($30 delegated from Sales)");
  console.log("    + Junior blocked gift_cards    (attenuated: parent didn't block them)");
  console.log("");
  console.log("  Cascade revocation:");
  console.log("    ✗ Sales revoked → Junior denied DENIED  (cascade revocation)");
  console.log("    ✓ Finance still works           ALLOWED (independent cap unaffected)");
  console.log("");
  console.log("  Every agent could only do its job. No cross-boundary access.");
  console.log("  Delegation attenuated. Revocation cascaded. Finance was unaffected.");
  console.log("=".repeat(60));
}

// Allow standalone execution
if (require.main === module) {
  main().catch((err) => {
    console.error("\nFatal error:", err.message);
    process.exit(1);
  });
}
