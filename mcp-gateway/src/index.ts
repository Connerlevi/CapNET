/**
 * @capnet/mcp-gateway — CapNet Policy Enforcement for MCP
 *
 * Starts a CapNet MCP gateway on stdio. Agents connect to this gateway
 * as if it were a normal MCP server. Every tool call is enforced through
 * the CapNet proxy before being forwarded to upstream MCP servers.
 *
 * Usage:
 *   capnet-mcp-gateway --upstream "name:command:arg1,arg2" [--upstream ...]
 *
 * Example:
 *   capnet-mcp-gateway \
 *     --upstream "filesystem:npx:-y,@modelcontextprotocol/server-filesystem,/tmp" \
 *     --upstream "brave:npx:-y,@anthropic-ai/mcp-brave-search"
 *
 * The agent sees all tools from all upstreams, but CapNet enforces
 * which tools the agent is allowed to call based on its capability.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CapNetMcpGateway } from "./gateway.js";
import type { UpstreamServer, GatewayConfig } from "./types.js";

export { CapNetMcpGateway } from "./gateway.js";
export { GatewayEnforcer } from "./enforcer.js";
export { UpstreamManager } from "./upstream.js";
export type { GatewayConfig, UpstreamServer, GatewayTool } from "./types.js";
export { classifyTool, DEFAULT_TOOL_CATEGORIES } from "./types.js";

function parseArgs(argv: string[]): { config: GatewayConfig; upstreams: UpstreamServer[] } {
  const config: GatewayConfig = {};
  const upstreams: UpstreamServer[] = [];

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--upstream": {
        if (!next) {
          console.error("--upstream requires a value: name:command:arg1,arg2");
          process.exit(1);
        }
        const parts = next.split(":");
        if (parts.length < 2) {
          console.error(`Invalid upstream format: ${next}. Expected name:command[:arg1,arg2]`);
          process.exit(1);
        }
        const [name, command, ...argParts] = parts;
        const args = argParts.join(":").split(",").filter(Boolean);
        upstreams.push({ name: name!, command: command!, args });
        i++;
        break;
      }
      case "--proxy-url":
        if (next) { config.proxyUrl = next; i++; }
        break;
      case "--agent-id":
        if (next) { config.agentId = next; i++; }
        break;
      case "--fail-policy":
        if (next) { config.failPolicy = next as "closed" | "open"; i++; }
        break;
      case "--help":
        console.error(`
capnet-mcp-gateway — CapNet Policy Enforcement for MCP

Usage:
  capnet-mcp-gateway --upstream "name:command:arg1,arg2" [options]

Options:
  --upstream NAME:CMD:ARGS   Add an upstream MCP server (repeatable)
  --proxy-url URL            CapNet proxy URL (default: http://127.0.0.1:3100)
  --agent-id ID              Agent ID (default: agent:mcp)
  --fail-policy POLICY       "closed" or "open" (default: closed)
  --help                     Show this help

Example:
  capnet-mcp-gateway \\
    --upstream "fs:npx:-y,@modelcontextprotocol/server-filesystem,/tmp" \\
    --upstream "search:npx:-y,@anthropic-ai/mcp-brave-search"
`);
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return { config, upstreams };
}

async function main() {
  const { config, upstreams } = parseArgs(process.argv);

  if (upstreams.length === 0) {
    console.error("[capnet-gateway] No upstreams specified. Use --upstream to add MCP servers.");
    console.error("[capnet-gateway] Run with --help for usage.");
    process.exit(1);
  }

  const gateway = new CapNetMcpGateway(config);

  // Resolve identity
  await gateway.ensureReady();
  console.error(`[capnet-gateway] Agent: ${gateway.agentId}`);
  console.error(`[capnet-gateway] Pubkey: ${gateway.agentPubkey.slice(0, 20)}...`);

  // Check proxy health
  const proxyOk = await gateway.checkProxy();
  if (!proxyOk) {
    console.error(`[capnet-gateway] WARNING: CapNet proxy unreachable at ${config.proxyUrl ?? "http://127.0.0.1:3100"}`);
    if (config.failPolicy !== "open") {
      console.error("[capnet-gateway] All tool calls will be denied (fail-closed). Start proxy with: npm run dev");
    }
  } else {
    console.error("[capnet-gateway] CapNet proxy: connected");
  }

  // Connect to upstreams
  for (const upstream of upstreams) {
    try {
      const tools = await gateway.addUpstream(upstream);
      console.error(`[capnet-gateway] Upstream "${upstream.name}": ${tools.length} tools discovered`);
      for (const tool of tools) {
        console.error(`[capnet-gateway]   - ${tool.name} (${tool.category})`);
      }
    } catch (err) {
      console.error(`[capnet-gateway] Failed to connect to upstream "${upstream.name}": ${err instanceof Error ? err.message : err}`);
    }
  }

  const totalTools = gateway.tools.length;
  console.error(`[capnet-gateway] Gateway ready: ${totalTools} tools from ${gateway.upstreamCount} upstream(s)`);
  console.error("[capnet-gateway] Every tool call routes through CapNet policy enforcement.");

  // Start the stdio transport
  const transport = new StdioServerTransport();
  await gateway.connect(transport);
}

// Only run main when executed directly (not imported)
const isMain = process.argv[1]?.includes("mcp-gateway");
if (isMain) {
  main().catch((err) => {
    console.error("[capnet-gateway] Fatal:", err);
    process.exit(1);
  });
}
