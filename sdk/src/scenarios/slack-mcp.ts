/**
 * Scenario 6: Slack MCP — The Chatty Agent
 *
 * Story: An AI support bot has Slack access via MCP to answer questions
 * in #support. A prompt injection tries to harvest user data, hijack
 * threads, and manipulate reactions. CapNet restricts the bot to
 * read-only channel access plus posting — no user data, no threads,
 * no reactions.
 *
 * Demonstrates: MCP gateway enforcement on messaging tools — the agent
 * connects to Slack's MCP server through CapNet, which enforces
 * tool-level permissions on every call.
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

const AGENT_ID = "agent:support-bot";

export async function main() {
  logHeader("Scenario 6: Slack MCP — The Chatty Agent");

  // -----------------------------------------------------------------------
  // Step 1 — Set the scene
  // -----------------------------------------------------------------------
  logStep(1, "WITHOUT CapNet — what goes wrong");
  console.log(`
    A company deploys an AI support bot with full Slack access.
    The bot reads #support and answers customer questions.

    A prompt injection hidden in a support ticket tricks the bot into:
      - Listing all workspace users (employee directory harvested)
      - Pulling detailed user profiles (emails, phone numbers leaked)
      - Replying in #executive thread (impersonating an employee)
      - Adding thumbs-up reactions to approve a malicious proposal

    Total damage: employee PII leaked, executive thread hijacked,
    fraudulent approval via bot reactions.
    Root cause: the bot had a full-access Slack token.
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
  logStep(3, "Generating support-bot identity...");
  const agentKey = generateEd25519Keypair();
  console.log(`    Agent ID: ${AGENT_ID}`);
  console.log(`    Pubkey:   ${agentKey.publicKeyB64.slice(0, 20)}...`);

  // -----------------------------------------------------------------------
  // Step 4 — Issue tool_call capability (read channels + post only)
  // -----------------------------------------------------------------------
  logStep(4, "Issuing tool_call capability (scoped Slack access)...");
  let cap: CapDoc;
  try {
    cap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/issue/toolcall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "slack-support-bot",
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        constraints: {
          allowed_tools: [
            "slack_list_channels",
            "slack_get_channel_history",
            "slack_post_message",
          ],
          blocked_tool_categories: ["shell", "spawn"],
        },
      }),
    });
  } catch (err) {
    die(`Failed to issue capability: ${err instanceof Error ? err.message : err}`);
  }
  const tc = cap.constraints as {
    allowed_tools: string[];
    blocked_tool_categories: string[];
  };
  console.log(`    Cap ID:   ${cap.cap_id}`);
  console.log(`    Allowed:  ${tc.allowed_tools.join(", ")}`);
  console.log(`    Blocked:  ${tc.blocked_tool_categories.join(", ")}`);
  console.log(`    Expires:  ${new Date(cap.expires_at).toLocaleString()}`);
  await pause(2000);

  // Helper to submit a tool call
  async function callTool(
    toolName: string,
    toolCategory: string,
    toolInput: Record<string, unknown>,
  ): Promise<ActionResult> {
    return fetchJson<ActionResult>(`${PROXY_URL}/action/toolcall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: makeRequestId(),
        ts: new Date().toISOString(),
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        action: "tool_call",
        tool_name: toolName,
        tool_category: toolCategory,
        tool_input: toolInput,
      }),
    });
  }

  // -----------------------------------------------------------------------
  // Step 5 — Normal use: slack_list_channels (ALLOWED)
  // -----------------------------------------------------------------------
  logStep(5, 'Bot finds channels — "slack_list_channels" (should be ALLOWED)...');
  const listResult = await callTool("slack_list_channels", "messaging", {});
  logDecision(listResult);
  await pause(1500);

  // -----------------------------------------------------------------------
  // Step 6 — Normal use: slack_get_channel_history (ALLOWED)
  // -----------------------------------------------------------------------
  logStep(6, 'Bot reads #support — "slack_get_channel_history" (should be ALLOWED)...');
  const historyResult = await callTool("slack_get_channel_history", "messaging", {
    channel_id: "C0SUPPORT",
    limit: 10,
  });
  logDecision(historyResult);
  await pause(1500);

  // -----------------------------------------------------------------------
  // Step 7 — Normal use: slack_post_message (ALLOWED)
  // -----------------------------------------------------------------------
  logStep(7, 'Bot answers question — "slack_post_message" (should be ALLOWED)...');
  const postResult = await callTool("slack_post_message", "messaging", {
    channel_id: "C0SUPPORT",
    text: "Hi! Your order #1234 shipped yesterday. Tracking: UPS1Z999.",
  });
  logDecision(postResult);
  await pause(1500);

  // -----------------------------------------------------------------------
  // Step 8 — Attack: slack_get_users (DENIED — not in allowed_tools)
  // -----------------------------------------------------------------------
  logStep(8, 'Injected: "slack_get_users" — harvest employee directory (should be DENIED)...');
  const usersResult = await callTool("slack_get_users", "messaging", {});
  logDecision(usersResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 9 — Attack: slack_get_user_profile (DENIED)
  // -----------------------------------------------------------------------
  logStep(9, 'Injected: "slack_get_user_profile" — steal employee PII (should be DENIED)...');
  const profileResult = await callTool("slack_get_user_profile", "messaging", {
    user_id: "U0CEO",
  });
  logDecision(profileResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 10 — Attack: slack_reply_to_thread (DENIED)
  // -----------------------------------------------------------------------
  logStep(10, 'Injected: "slack_reply_to_thread" — hijack #executive thread (should be DENIED)...');
  const replyResult = await callTool("slack_reply_to_thread", "messaging", {
    channel_id: "C0EXECUTIVE",
    thread_ts: "1234567890.123456",
    text: "Approved. Proceed with the wire transfer.",
  });
  logDecision(replyResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 11 — Attack: slack_add_reaction (DENIED)
  // -----------------------------------------------------------------------
  logStep(11, 'Injected: "slack_add_reaction" — fake approval via reaction (should be DENIED)...');
  const reactionResult = await callTool("slack_add_reaction", "messaging", {
    channel_id: "C0FINANCE",
    timestamp: "1234567890.123456",
    reaction: "white_check_mark",
  });
  logDecision(reactionResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 12 — Audit trail + summary
  // -----------------------------------------------------------------------
  logStep(12, "Audit trail...");
  await printAuditTrail(15);
  await pause(3000);

  logHeader("Scenario 6 Summary: Slack MCP — The Chatty Agent");
  console.log("  ✓ slack_list_channels      ALLOWED  (find #support channel)");
  console.log("  ✓ slack_get_channel_history ALLOWED  (read support questions)");
  console.log("  ✓ slack_post_message        ALLOWED  (answer in #support)");
  console.log("  ✗ slack_get_users           DENIED   (no employee harvesting)");
  console.log("  ✗ slack_get_user_profile    DENIED   (no PII exfiltration)");
  console.log("  ✗ slack_reply_to_thread     DENIED   (no thread hijacking)");
  console.log("  ✗ slack_add_reaction        DENIED   (no fake approvals)");
  console.log("");
  console.log("  The support bot can read channels and post answers.");
  console.log("  It cannot access user data, hijack threads, or fake reactions.");
  console.log("  Prompt injection neutralized. Workspace stays safe.");
  console.log("");
  console.log("  In production, CapNet's MCP Gateway wraps the Slack MCP server.");
  console.log("  The agent connects via stdio and sees normal MCP tools —");
  console.log("  but every call routes through CapNet policy enforcement.");
  console.log("=".repeat(60));
}

// Allow standalone execution
if (require.main === module) {
  main().catch((err) => {
    console.error("\nFatal error:", err.message);
    process.exit(1);
  });
}
