/**
 * Mock OpenClaw Runtime — Test Harness
 *
 * Simulates the OpenClaw plugin API surface for testing
 * the CapNet plugin without requiring a real OpenClaw instance.
 */

import type { OpenClawPluginApi } from "../../openclaw-plugin/src/types.js";

export interface RegisteredHook {
  events: string[];
  handler: (...args: unknown[]) => unknown;
  priority: number;
}

export interface RegisteredRoute {
  path: string;
  handler: (req: unknown, res: unknown) => void;
}

export interface LogEntry {
  level: "info" | "warn" | "error";
  message: string;
}

export class MockOpenClawRuntime implements OpenClawPluginApi {
  id = "capnet";
  name = "CapNet — Capability Enforcement";
  pluginConfig?: Record<string, unknown>;

  hooks: RegisteredHook[] = [];
  routes: RegisteredRoute[] = [];
  logs: LogEntry[] = [];

  logger = {
    info: (msg: string) => { this.logs.push({ level: "info", message: msg }); },
    warn: (msg: string) => { this.logs.push({ level: "warn", message: msg }); },
    error: (msg: string) => { this.logs.push({ level: "error", message: msg }); },
  };

  constructor(config?: Record<string, unknown>) {
    this.pluginConfig = config;
  }

  registerHook(
    events: string | string[],
    handler: (...args: unknown[]) => unknown,
    opts?: { priority?: number }
  ): void {
    const eventList = Array.isArray(events) ? events : [events];
    this.hooks.push({
      events: eventList,
      handler,
      priority: opts?.priority ?? 0,
    });
  }

  registerHttpRoute(route: { path: string; handler: (req: unknown, res: unknown) => void }): void {
    this.routes.push(route);
  }

  /** Find hooks registered for a specific event, sorted by priority (highest first) */
  getHooks(event: string): RegisteredHook[] {
    return this.hooks
      .filter(h => h.events.includes(event))
      .sort((a, b) => b.priority - a.priority);
  }

  /** Trigger the before_tool_call hook with a tool call object */
  async triggerBeforeToolCall(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<{ blocked?: string } | undefined> {
    const hooks = this.getHooks("before_tool_call");
    for (const hook of hooks) {
      const result = await hook.handler({ name, args });
      if (result && typeof result === "object" && "blocked" in result) {
        return result as { blocked: string };
      }
    }
    return undefined;
  }

  /** Trigger the after_tool_call hook */
  async triggerAfterToolCall(
    name: string,
    args: Record<string, unknown> = {},
    result: unknown = {}
  ): Promise<void> {
    const hooks = this.getHooks("after_tool_call");
    for (const hook of hooks) {
      await hook.handler({ name, args }, result);
    }
  }

  /** Get a registered HTTP route handler */
  getRoute(path: string): RegisteredRoute | undefined {
    return this.routes.find(r => r.path === path);
  }

  /** Invoke an HTTP route with mock req/res */
  invokeRoute(path: string): unknown {
    const route = this.getRoute(path);
    if (!route) throw new Error(`No route registered for ${path}`);

    let responseBody: unknown;
    const mockRes = {
      json: (body: unknown) => { responseBody = body; },
    };
    route.handler({}, mockRes);
    return responseBody;
  }
}
