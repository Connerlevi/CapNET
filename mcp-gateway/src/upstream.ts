/**
 * CapNet MCP Gateway — Upstream Manager
 *
 * Manages connections to downstream MCP tool servers.
 * Discovers tools from each server and maintains the connection pool.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { UpstreamServer, GatewayTool } from "./types.js";
import { classifyTool } from "./types.js";

export interface ConnectedUpstream {
  name: string;
  client: Client;
  transport: StdioClientTransport;
  tools: GatewayTool[];
}

export class UpstreamManager {
  private upstreams: Map<string, ConnectedUpstream> = new Map();

  /** Connect to an upstream MCP server and discover its tools */
  async connect(server: UpstreamServer): Promise<GatewayTool[]> {
    const client = new Client(
      { name: `capnet-gateway->${server.name}`, version: "0.1.0" },
    );

    const transportOpts: { command: string; args: string[]; env?: Record<string, string> } = {
      command: server.command,
      args: server.args,
    };
    if (server.env) {
      transportOpts.env = server.env;
    }
    const transport = new StdioClientTransport(transportOpts);

    await client.connect(transport);

    // Discover tools from the upstream server
    const result = await client.listTools();
    const tools: GatewayTool[] = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
      upstream: server.name,
      category: classifyTool(tool.name),
    }));

    this.upstreams.set(server.name, { name: server.name, client, transport, tools });

    return tools;
  }

  /** Get all discovered tools across all upstreams */
  getAllTools(): GatewayTool[] {
    const tools: GatewayTool[] = [];
    for (const upstream of this.upstreams.values()) {
      tools.push(...upstream.tools);
    }
    return tools;
  }

  /** Find which upstream owns a given tool */
  findUpstream(toolName: string): ConnectedUpstream | undefined {
    for (const upstream of this.upstreams.values()) {
      if (upstream.tools.some(t => t.name === toolName)) {
        return upstream;
      }
    }
    return undefined;
  }

  /** Forward a tool call to the appropriate upstream */
  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ content: unknown[]; isError?: boolean | undefined }> {
    const upstream = this.findUpstream(toolName);
    if (!upstream) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    const result = await upstream.client.callTool({
      name: toolName,
      arguments: args,
    });

    return {
      content: (result.content ?? []) as unknown[],
      isError: result.isError === true,
    };
  }

  /** Disconnect from all upstreams */
  async disconnectAll(): Promise<void> {
    for (const upstream of this.upstreams.values()) {
      try {
        await upstream.client.close();
      } catch {
        // best effort
      }
    }
    this.upstreams.clear();
  }

  /** Get connected upstream count */
  get size(): number {
    return this.upstreams.size;
  }
}
