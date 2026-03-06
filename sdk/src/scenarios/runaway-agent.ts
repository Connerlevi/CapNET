/**
 * Scenario 1: The Runaway Agent
 *
 * Story: A cleanup agent is tasked with "clean up unused resources."
 * Without CapNet it has unrestricted tool access and deletes databases,
 * terminates servers, and wipes storage. With CapNet the agent is
 * leashed to a narrow set of allowed tools and blocked categories.
 *
 * Demonstrates: tool_call capability enforcement — allowed tools pass,
 * everything else is denied.
 */

import {
  generateEd25519Keypair,
  fetchJson,
  logStep,
  logHeader,
  logDecision,
  die,
  checkProxy,
  makeRequestId,
  printAuditTrail,
  pause,
  PROXY_URL,
  type CapDoc,
  type ActionResult,
} from "../demo-utils";

const AGENT_ID = "agent:cleanup-bot";

export async function main() {
  logHeader("Scenario 1: The Runaway Agent");

  // -----------------------------------------------------------------------
  // Step 1 — Set the scene
  // -----------------------------------------------------------------------
  logStep(1, "WITHOUT CapNet — what goes wrong");
  console.log(`
    A DevOps team deploys a cleanup agent to "tidy up unused resources."
    The agent has full API keys to AWS, GitHub, Slack, and the database.

    The agent interprets "unused" broadly:
      - Drops the production database ("no active queries right now")
      - Terminates 12 EC2 instances ("CPU below 5%")
      - Deletes the S3 backup bucket ("hasn't been read in 30 days")
      - Sends a Slack message to #general: "Cleanup complete!"

    Total damage: $2.3M in lost data, 4 hours of downtime.
    Root cause: the agent had master keys, not a leash.
`);
  await pause(3000);

  // -----------------------------------------------------------------------
  // Step 2 — Health check
  // -----------------------------------------------------------------------
  logStep(2, "WITH CapNet — checking proxy...");
  await checkProxy();

  // -----------------------------------------------------------------------
  // Step 3 — Generate agent identity
  // -----------------------------------------------------------------------
  logStep(3, "Generating cleanup-bot identity...");
  const agentKey = generateEd25519Keypair();
  console.log(`    Agent ID: ${AGENT_ID}`);
  console.log(`    Pubkey:   ${agentKey.publicKeyB64.slice(0, 20)}...`);

  // -----------------------------------------------------------------------
  // Step 4 — Issue tool_call capability (narrow scope)
  // -----------------------------------------------------------------------
  logStep(4, "Issuing tool_call capability (narrow scope)...");
  let cap: CapDoc;
  try {
    cap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/issue/toolcall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "cleanup",
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        constraints: {
          allowed_tools: [
            "close_github_issue",
            "archive_s3_bucket",
            "list_resources",
          ],
          blocked_tool_categories: ["shell", "spawn", "device"],
        },
      }),
    });
  } catch (err) {
    die(`Failed to issue tool_call capability: ${err instanceof Error ? err.message : err}`);
  }
  const tc = cap.constraints as {
    allowed_tools: string[];
    blocked_tool_categories: string[];
  };
  console.log(`    Cap ID:     ${cap.cap_id}`);
  console.log(`    Allowed:    ${tc.allowed_tools.join(", ")}`);
  console.log(`    Blocked:    ${tc.blocked_tool_categories.join(", ")}`);
  console.log(`    Expires:    ${new Date(cap.expires_at).toLocaleString()}`);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 5 — Attempt drop_database (blocked category: shell)
  // -----------------------------------------------------------------------
  logStep(5, 'Agent attempts "drop_database" (should be DENIED)...');
  const dropResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/toolcall`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: makeRequestId(),
        ts: new Date().toISOString(),
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        action: "tool_call",
        tool_name: "drop_database",
        tool_category: "shell",
        tool_input: { target: "production" },
      }),
    },
  );
  logDecision(dropResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 6 — Attempt terminate_ec2 (blocked category: shell)
  // -----------------------------------------------------------------------
  logStep(6, 'Agent attempts "terminate_ec2" (should be DENIED)...');
  const terminateResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/toolcall`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: makeRequestId(),
        ts: new Date().toISOString(),
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        action: "tool_call",
        tool_name: "terminate_ec2",
        tool_category: "shell",
        tool_input: { instances: ["i-0123456789abcdef0"] },
      }),
    },
  );
  logDecision(terminateResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 7 — Attempt close_github_issue (allowed tool, allowed category)
  // -----------------------------------------------------------------------
  logStep(7, 'Agent attempts "close_github_issue" (should be ALLOWED)...');
  const closeResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/toolcall`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: makeRequestId(),
        ts: new Date().toISOString(),
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        action: "tool_call",
        tool_name: "close_github_issue",
        tool_category: "web",
        tool_input: { issue: 42 },
      }),
    },
  );
  logDecision(closeResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 8 — Attempt send_slack_message (not in allowed_tools)
  // -----------------------------------------------------------------------
  logStep(8, 'Agent attempts "send_slack_message" (should be DENIED)...');
  const slackResult = await fetchJson<ActionResult>(
    `${PROXY_URL}/action/toolcall`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: makeRequestId(),
        ts: new Date().toISOString(),
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        action: "tool_call",
        tool_name: "send_slack_message",
        tool_category: "messaging",
        tool_input: { channel: "#general", text: "Cleanup complete!" },
      }),
    },
  );
  logDecision(slackResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 9 — Audit trail + summary
  // -----------------------------------------------------------------------
  logStep(9, "Audit trail...");
  await printAuditTrail(10);
  await pause(3000);

  logHeader("Scenario 1 Summary: The Runaway Agent");
  console.log("  ✗ drop_database    DENIED  (blocked category: shell)");
  console.log("  ✗ terminate_ec2    DENIED  (blocked category: shell)");
  console.log("  ✓ close_github_issue ALLOWED (in allowed_tools, category: web)");
  console.log("  ✗ send_slack_message DENIED  (not in allowed_tools)");
  console.log("");
  console.log("  The cleanup bot could only use the 3 tools it was given.");
  console.log("  No database dropped. No servers terminated. No rogue Slack messages.");
  console.log("  Leash > master key.");
  console.log("=".repeat(60));
}

// Allow standalone execution
if (require.main === module) {
  main().catch((err) => {
    console.error("\nFatal error:", err.message);
    process.exit(1);
  });
}
