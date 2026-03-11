/**
 * Run all five CapNet demo scenarios sequentially.
 *
 * Each scenario tells a distinct story about why capability-based
 * authorization matters for AI agents.
 */

import { main as runaway } from "./runaway-agent";
import { main as hijack } from "./agent-hijack";
import { main as company } from "./multi-agent-company";
import { main as openclawHijack } from "./openclaw-hijack";
import { main as githubMcp } from "./github-mcp";

async function main() {
  console.log("\n" + "#".repeat(60));
  console.log("#  CapNet Demo Scenarios — Full Suite");
  console.log("#".repeat(60));

  await runaway();

  console.log("\n\n");

  await hijack();

  console.log("\n\n");

  await company();

  console.log("\n\n");

  await openclawHijack();

  console.log("\n\n");

  await githubMcp();

  console.log("\n" + "#".repeat(60));
  console.log("#  All 5 scenarios complete.");
  console.log("#  Every agent was leashed. Every attack was stopped.");
  console.log("#".repeat(60));
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
