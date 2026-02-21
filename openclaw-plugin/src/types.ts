/**
 * CapNet OpenClaw Plugin — Types
 *
 * Defines the plugin config shape and OpenClaw API surface we depend on.
 * We declare only what we use to avoid coupling to OpenClaw internals.
 */

// -----------------------------------------------------------------------------
// Plugin config (matches openclaw.plugin.json configSchema)
// -----------------------------------------------------------------------------

export interface CapNetPluginConfig {
  proxyUrl?: string;
  agentId?: string;
  agentPubkey?: string;
  agentSecretKey?: string;
  failPolicy?: "closed" | "open";
  timeoutMs?: number;
  gatedTools?: string[];
  exemptTools?: string[];
}

// -----------------------------------------------------------------------------
// OpenClaw Plugin API (minimal surface we depend on)
// -----------------------------------------------------------------------------

export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
}

export interface BeforeToolCallResult {
  /** If set, the tool call is blocked and this message is returned to the agent */
  blocked?: string;
}

export interface OpenClawPluginApi {
  id: string;
  name: string;
  pluginConfig?: Record<string, unknown>;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  registerHook: (
    events: string | string[],
    handler: (...args: unknown[]) => unknown,
    opts?: { priority?: number }
  ) => void;
  registerHttpRoute: (route: { path: string; handler: (req: unknown, res: unknown) => void }) => void;
}

// -----------------------------------------------------------------------------
// Tool category mapping
// -----------------------------------------------------------------------------

/** Map OpenClaw tool names to CapNet tool categories */
export const TOOL_CATEGORY_MAP: Record<string, string> = {
  // Shell
  exec: "shell",

  // Web
  web_fetch: "web",
  web_search: "web",

  // Browser
  browser: "browser",
  browser_navigate: "browser",
  browser_click: "browser",
  browser_type: "browser",
  browser_snapshot: "browser",
  browser_screenshot: "browser",

  // Messaging
  whatsapp_send: "messaging",
  telegram_send: "messaging",
  discord_send: "messaging",
  slack_send: "messaging",
  signal_send: "messaging",
  message_send: "messaging",

  // Filesystem
  fs_read: "filesystem",
  fs_write: "filesystem",
  fs_delete: "filesystem",
  fs_move: "filesystem",
  apply_patch: "filesystem",

  // Spawn
  sessions_spawn: "spawn",
  sessions_send: "spawn",

  // Device
  camera: "device",
  location: "device",
  contacts: "device",
  screen_capture: "device",
};

/** Get the CapNet tool category for an OpenClaw tool name */
export function getToolCategory(toolName: string): string {
  return TOOL_CATEGORY_MAP[toolName] ?? "other";
}
