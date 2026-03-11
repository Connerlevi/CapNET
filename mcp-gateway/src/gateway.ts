/**
 * CapNet MCP Gateway
 *
 * An MCP server that sits between agents and upstream MCP tool servers.
 * The agent connects to the gateway as if it were a normal MCP server.
 * The gateway enforces CapNet capabilities on every tool call, then
 * forwards allowed calls to the real upstream servers.
 *
 * Architecture:
 *   Agent → MCP Gateway (CapNet enforcement) → Upstream MCP Servers
 *
 * The agent doesn't know CapNet is there. That's the point.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { UpstreamManager } from "./upstream.js";
import { GatewayEnforcer } from "./enforcer.js";
import type { GatewayConfig, UpstreamServer, GatewayTool } from "./types.js";

export class CapNetMcpGateway {
  private server: McpServer;
  private upstreams: UpstreamManager;
  private enforcer: GatewayEnforcer;
  private config: GatewayConfig;
  private allTools: GatewayTool[] = [];

  constructor(config: GatewayConfig = {}) {
    this.config = config;
    this.enforcer = new GatewayEnforcer(config);
    this.upstreams = new UpstreamManager();

    this.server = new McpServer({
      name: config.serverName ?? "capnet-mcp-gateway",
      version: config.serverVersion ?? "0.1.0",
    });
  }

  /** Connect to upstream MCP servers and discover their tools */
  async addUpstream(upstream: UpstreamServer): Promise<GatewayTool[]> {
    const tools = await this.upstreams.connect(upstream);
    this.allTools = this.upstreams.getAllTools();

    // Register each discovered tool on the gateway server
    for (const tool of tools) {
      this.registerGatewayTool(tool);
    }

    return tools;
  }

  /** Register a single tool on the gateway, with CapNet enforcement */
  private registerGatewayTool(tool: GatewayTool): void {
    const enforcer = this.enforcer;
    const upstreams = this.upstreams;

    // Use the raw JSON Schema approach since upstream tools provide JSON Schema, not Zod
    this.server.registerTool(
      tool.name,
      {
        description: tool.description
          ? `${tool.description} [via CapNet]`
          : `[via CapNet]`,
        annotations: {
          title: tool.name,
        },
      },
      async (args: Record<string, unknown>) => {
        // Step 1: Enforce through CapNet proxy
        const result = await enforcer.enforce(
          tool.name,
          args,
          tool.category,
        );

        if (!result.allowed) {
          // Return denial as tool error — the agent sees a clear reason
          const errorInfo = result.errorType ? ` [${result.errorType}]` : "";
          return {
            content: [
              {
                type: "text" as const,
                text: `[CapNet] Tool "${tool.name}" denied: ${result.reason}${errorInfo}`,
              },
            ],
            isError: true,
          };
        }

        // Step 2: Forward to upstream MCP server
        try {
          const upstream = await upstreams.callTool(tool.name, args);
          return {
            content: upstream.content as Array<{ type: "text"; text: string }>,
            isError: upstream.isError,
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `[CapNet Gateway] Upstream error: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  /** Ensure the enforcer identity is resolved */
  async ensureReady(): Promise<void> {
    await this.enforcer.ensureReady();
  }

  /** Check if the CapNet proxy is reachable */
  async checkProxy(): Promise<boolean> {
    return this.enforcer.checkProxy();
  }

  /** Connect the gateway to a transport (stdio, HTTP, etc.) */
  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  /** Shut down the gateway */
  async close(): Promise<void> {
    await this.upstreams.disconnectAll();
    await this.server.close();
  }

  /** Get all tools exposed through the gateway */
  get tools(): GatewayTool[] {
    return this.allTools;
  }

  /** Get the enforcer's agent ID */
  get agentId(): string {
    return this.enforcer.id;
  }

  /** Get the enforcer's public key */
  get agentPubkey(): string {
    return this.enforcer.publicKey;
  }

  /** Get the number of connected upstreams */
  get upstreamCount(): number {
    return this.upstreams.size;
  }
}
