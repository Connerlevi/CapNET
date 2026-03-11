/**
 * CapNet MCP Gateway — Types
 *
 * Configuration and interfaces for the MCP policy enforcement gateway.
 */

export interface GatewayConfig {
  /** CapNet proxy URL (default: http://127.0.0.1:3100) */
  proxyUrl?: string;

  /** Agent ID for capability lookup (default: agent:mcp) */
  agentId?: string;

  /** Pre-configured agent public key (auto-generated if omitted) */
  agentPubkey?: string;

  /** Directory for auto-generated keypairs (default: ~/.capnet/keys) */
  keysDir?: string;

  /** How to handle proxy failures: "closed" = deny, "open" = allow */
  failPolicy?: "closed" | "open";

  /** Proxy request timeout in ms (default: 2000) */
  timeoutMs?: number;

  /** Gateway server name exposed to MCP clients */
  serverName?: string;

  /** Gateway server version */
  serverVersion?: string;
}

export interface UpstreamServer {
  /** Display name for this upstream */
  name: string;

  /** Command to launch the MCP server */
  command: string;

  /** Arguments for the command */
  args: string[];

  /** Environment variables for the subprocess */
  env?: Record<string, string>;
}

export interface GatewayTool {
  /** Tool name as exposed to the agent */
  name: string;

  /** Tool description */
  description?: string | undefined;

  /** JSON Schema for tool input */
  inputSchema: Record<string, unknown>;

  /** Which upstream server owns this tool */
  upstream: string;

  /** CapNet tool category for enforcement */
  category: string;
}

/** Map tool names to CapNet categories */
export const DEFAULT_TOOL_CATEGORIES: Record<string, string> = {
  // Filesystem
  read_file: "filesystem",
  write_file: "filesystem",
  list_directory: "filesystem",
  create_directory: "filesystem",
  move_file: "filesystem",
  search_files: "filesystem",
  get_file_info: "filesystem",
  list_allowed_directories: "filesystem",
  edit_file: "filesystem",
  read_multiple_files: "filesystem",
  directory_tree: "filesystem",

  // Shell
  execute_command: "shell",
  run_command: "shell",

  // Web / Search
  brave_web_search: "web",
  brave_local_search: "web",
  fetch: "web",

  // Browser
  puppeteer_navigate: "browser",
  puppeteer_screenshot: "browser",
  puppeteer_click: "browser",
  puppeteer_fill: "browser",
  puppeteer_evaluate: "browser",

  // Database
  query: "database",
  read_query: "database",
  write_query: "database",
  create_table: "database",
  list_tables: "database",
  describe_table: "database",

  // Git / GitHub
  create_repository: "git",
  search_repositories: "git",
  create_issue: "git",
  create_pull_request: "git",
  push_files: "git",
  fork_repository: "git",
  create_or_update_file: "git",
  get_file_contents: "git",
  create_branch: "git",
  list_issues: "git",
  update_issue: "git",
  add_issue_comment: "git",
  search_code: "git",
  search_issues: "git",
  search_users: "git",
  list_commits: "git",
  get_issue: "git",
  get_pull_request: "git",
  list_pull_requests: "git",
  create_pull_request_review: "git",
  merge_pull_request: "git",
  get_pull_request_files: "git",
  get_pull_request_status: "git",
  update_pull_request_branch: "git",
  get_pull_request_comments: "git",
  get_pull_request_reviews: "git",

  // Messaging
  send_message: "messaging",
  slack_post_message: "messaging",
};

/** Classify a tool name into a CapNet category */
export function classifyTool(toolName: string): string {
  return DEFAULT_TOOL_CATEGORIES[toolName] ?? "other";
}
