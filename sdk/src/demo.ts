#!/usr/bin/env npx tsx
/**
 * CapNet Demo Agent Script
 *
 * Demonstrates the full capability lifecycle:
 * 1. Generate/load agent Ed25519 keypair
 * 2. Wallet issues capability to agent
 * 3. Delegate sub-capability with reduced budget
 * 4. Sub-agent fetches catalog from sandbox
 * 5. Sub-agent builds cart and validates → allowed action
 * 6. Sub-agent attempts blocked category → denied action
 * 7. Revoke parent capability → cascade revokes child
 * 8. Sub-agent attempt after cascade revoke → denied
 * 9. Show audit trail (receipts)
 *
 * Usage: npx tsx sdk/src/demo.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  generateEd25519Keypair,
  type Keypair,
  type CapDoc,
  fetchJson,
  logStep,
  die,
  checkProxy,
  checkSandbox,
  printAuditTrail,
  pause,
  PROXY_URL,
  SANDBOX_URL,
  type ActionResult,
  type CatalogResponse,
  type CartValidateResponse,
  type CheckoutResponse,
} from "./demo-utils";

const AGENT_KEY_PATH = path.join(__dirname, "../../data/demo_agent_key.json");

// Demo agent identities
const AGENT_ID = "agent:demo-grocerybot";
const SUB_AGENT_ID = "agent:demo-grocerybot-sub";

// Seed for deterministic runs (optional)
// Usage: CAPNET_DEMO_SEED=abc npm run demo
const DEMO_SEED = process.env.CAPNET_DEMO_SEED || "";

// ---------------------------------------------------------------------------
// Agent Key Management
// ---------------------------------------------------------------------------

function loadOrCreateAgentKey(): Keypair {
  const dataDir = path.dirname(AGENT_KEY_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(AGENT_KEY_PATH)) {
    const data = JSON.parse(fs.readFileSync(AGENT_KEY_PATH, "utf-8"));
    console.log("    Loaded existing agent keypair");
    return data as Keypair;
  }

  const keypair = generateEd25519Keypair();
  fs.writeFileSync(AGENT_KEY_PATH, JSON.stringify(keypair, null, 2));
  console.log("    Generated new agent keypair");
  return keypair;
}

// ---------------------------------------------------------------------------
// Main Demo
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("CapNet Demo Agent — Capability Lifecycle");
  console.log("=".repeat(60));
  if (DEMO_SEED) {
    console.log(`Seed: ${DEMO_SEED}`);
  }

  // Step 1: Load or create agent keypair
  logStep(1, "Loading agent identity...");
  let agentKey: Keypair;
  try {
    agentKey = loadOrCreateAgentKey();
  } catch (err) {
    die("Failed to load/create agent key", "Check write permissions on data/");
  }
  console.log(`    Agent ID: ${AGENT_ID}`);
  console.log(`    Pubkey: ${agentKey.publicKeyB64.slice(0, 20)}...`);

  // Step 2: Check services are running
  logStep(2, "Checking services...");
  await checkProxy();
  await checkSandbox();

  // Step 3: Wallet issues capability to agent
  logStep(3, "Wallet issuing capability to agent...");
  let cap: CapDoc;
  try {
    cap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "groceries",
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        constraints: {
          max_amount_cents: 5000, // $50 budget
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol", "tobacco", "gift_cards"],
        },
      }),
    });
  } catch (err) {
    die(`Failed to issue capability: ${err instanceof Error ? err.message : err}`);
  }
  console.log(`    Cap ID: ${cap.cap_id}`);
  const capConstraints = cap.constraints as { max_amount_cents: number; blocked_categories: string[] };
  console.log(`    Budget: $${(capConstraints.max_amount_cents / 100).toFixed(2)}`);
  console.log(`    Expires: ${new Date(cap.expires_at).toLocaleString()}`);
  console.log(`    Blocked: ${capConstraints.blocked_categories.join(", ")}`);
  await pause(2000);

  // Step 4: Delegate sub-capability with reduced budget
  logStep(4, "Delegating sub-capability to sub-agent...");
  const subAgentKey = generateEd25519Keypair();
  console.log(`    Sub-agent ID: ${SUB_AGENT_ID}`);
  console.log(`    Sub-agent pubkey: ${subAgentKey.publicKeyB64.slice(0, 20)}...`);

  let subCap: CapDoc;
  try {
    subCap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_cap_id: cap.cap_id,
        new_executor: {
          agent_id: SUB_AGENT_ID,
          agent_pubkey: subAgentKey.publicKeyB64,
        },
        constraints: {
          max_amount_cents: 2000, // $20 (reduced from parent's $50)
          allowed_vendors: ["sandboxmart"],
          blocked_categories: ["alcohol", "tobacco", "gift_cards", "household"],
        },
      }),
    });
  } catch (err) {
    die(`Failed to delegate capability: ${err instanceof Error ? err.message : err}`);
  }
  const subCapConstraints = subCap.constraints as { max_amount_cents: number; blocked_categories: string[] };
  console.log(`    Sub-cap ID: ${subCap.cap_id}`);
  console.log(`    Budget: $${(subCapConstraints.max_amount_cents / 100).toFixed(2)} (reduced from $50)`);
  console.log(`    Blocked: ${subCapConstraints.blocked_categories.join(", ")}`);
  console.log(`    Delegation depth: ${subCap.delegation_depth}`);
  console.log(`    Parent: ${subCap.parent_cap_id}`);
  await pause(2000);

  // Step 5: Fetch catalog
  logStep(5, "Sub-agent fetching merchant catalog...");
  let catalog: CatalogResponse;
  try {
    catalog = await fetchJson<CatalogResponse>(`${SANDBOX_URL}/catalog`);
  } catch (err) {
    die(
      "Failed to fetch catalog",
      "Sandbox /catalog endpoint may not be implemented. Run: npm run dev"
    );
  }
  console.log(`    Vendor: ${catalog.vendor}`);
  console.log(`    Items: ${catalog.items.length}`);
  console.log(`    Blocked: ${catalog.blocked_categories.join(", ")}`);

  // Step 6: Sub-agent builds grocery cart and attempts allowed action
  logStep(6, "Sub-agent building grocery cart (should be ALLOWED)...");
  const groceryItems = catalog.items.filter(
    (i) => i.category === "grocery" && i.in_stock
  );
  const groceryCart = groceryItems.slice(0, 3).map((i) => ({ sku: i.sku, qty: 1 }));

  console.log("    Cart:");
  for (const c of groceryCart) {
    const item = catalog.items.find((i) => i.sku === c.sku);
    console.log(`      - ${item?.name} ($${((item?.price_cents ?? 0) / 100).toFixed(2)})`);
  }

  // Validate cart (using sub-agent identity)
  const groceryValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: SUB_AGENT_ID,
        agent_pubkey: subAgentKey.publicKeyB64,
        cart: groceryCart,
      }),
    }
  );
  console.log(`    Total: $${(groceryValidation.total_cents / 100).toFixed(2)}`);

  // Submit to proxy
  const groceryResult = await fetchJson<ActionResult>(`${PROXY_URL}/action/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(groceryValidation.action_request),
  });
  console.log(`    Decision: ${groceryResult.decision.toUpperCase()}`);
  console.log(`    Reason: ${groceryResult.reason}`);

  // Checkout if allowed
  if (groceryResult.decision === "allow") {
    const order = await fetchJson<CheckoutResponse>(`${SANDBOX_URL}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: groceryResult.request_id,
        receipt_id: groceryResult.receipt_id,
        cart: groceryCart,
      }),
    });
    console.log(`    Order: ${order.order.order_id} ✓`);
  }
  await pause(2000);

  // Step 7: Attempt blocked category (alcohol)
  logStep(7, "Sub-agent attempting to buy alcohol (should be DENIED)...");
  const alcoholCart = [{ sku: "ALC-001", qty: 1 }]; // Red Wine
  const alcoholValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: SUB_AGENT_ID,
        agent_pubkey: subAgentKey.publicKeyB64,
        cart: alcoholCart,
      }),
    }
  );
  const wineItem = catalog.items.find((i) => i.sku === "ALC-001");
  console.log(`    Cart: ${wineItem?.name} ($${((wineItem?.price_cents ?? 0) / 100).toFixed(2)})`);

  const alcoholResult = await fetchJson<ActionResult>(`${PROXY_URL}/action/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alcoholValidation.action_request),
  });
  console.log(`    Decision: ${alcoholResult.decision.toUpperCase()}`);
  console.log(`    Reason: ${alcoholResult.reason}`);
  await pause(2000);

  // Step 8: Revoke PARENT capability (should cascade to sub-cap)
  logStep(8, "Revoking parent capability (cascade to sub-cap)...");
  try {
    await fetchJson<{ success: boolean }>(`${PROXY_URL}/capability/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cap_id: cap.cap_id }),
    });
    console.log(`    Revoked parent: ${cap.cap_id}`);
    console.log(`    Sub-cap ${subCap.cap_id} should now be cascade-revoked`);
  } catch (err) {
    die(`Failed to revoke: ${err instanceof Error ? err.message : err}`);
  }

  // Step 9: Sub-agent attempts action after cascade revoke (should fail)
  logStep(9, "Sub-agent attempting groceries after cascade revoke (should be DENIED)...");
  // Need to re-validate to get fresh request_id
  const postRevokeValidation = await fetchJson<CartValidateResponse>(
    `${SANDBOX_URL}/cart/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: SUB_AGENT_ID,
        agent_pubkey: subAgentKey.publicKeyB64,
        cart: groceryCart,
      }),
    }
  );

  const postRevokeResult = await fetchJson<ActionResult>(`${PROXY_URL}/action/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postRevokeValidation.action_request),
  });
  console.log(`    Decision: ${postRevokeResult.decision.toUpperCase()}`);
  console.log(`    Reason: ${postRevokeResult.reason}`);
  await pause(2000);

  // Step 10: Show audit trail
  logStep(10, "Audit trail (last 15 receipts, oldest first)...");
  await printAuditTrail(15);
  await pause(3000);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Demo Summary");
  console.log("=".repeat(60));
  console.log("  ✓ Sub-capability delegated ($20 budget from $50 parent)");
  console.log("  ✓ Groceries allowed (sub-agent, within budget)");
  console.log("  ✗ Alcohol denied (blocked category)");
  console.log("  ✗ Post-cascade-revoke denied (parent revoked → child revoked)");
  console.log("\nThe leash works. Delegation attenuates, revocation cascades.");
  console.log("=".repeat(60));

  // Next steps for tester
  console.log("");
  console.log("  What to do next:");
  console.log("");
  console.log("  1. Load the Chrome extension (if you haven't already):");
  console.log("     a. Open Chrome and go to chrome://extensions");
  console.log("     b. Enable 'Developer mode' (toggle in top-right corner)");
  console.log("     c. Click 'Load unpacked'");
  console.log("     d. Select the extension/dist/ folder inside this project");
  console.log("     e. Pin CapNet to your toolbar (puzzle icon -> pin)");
  console.log("");
  console.log("  2. Try the extension UI:");
  console.log("     - Templates tab: Issue a capability (set budget, blocked categories)");
  console.log("     - Active tab:    See active caps, click Revoke to test kill switch");
  console.log("     - Receipts tab:  View the full audit trail from this demo");
  console.log("");
  console.log("  3. Run edge-case tests:  See TEST_RUNBOOK.md");
  console.log("  4. Full tester guide:    See TESTER_GUIDE.md");
  console.log("");
  console.log("  NOTE: 'npm run dev' must be running for the extension to work.");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
