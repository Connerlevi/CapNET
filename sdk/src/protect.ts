import type { CapabilityHandle } from "./handle.js";
import type { ToolCategory } from "@capnet-auth/shared";

export interface ProtectOptions {
  capabilities: CapabilityHandle[];
  onDenied?: (error: Error, toolName: string) => void;
  defaultCategory?: ToolCategory;
}

export function protect<T extends object>(agent: T, options: ProtectOptions): T {
  const { capabilities, onDenied, defaultCategory } = options;

  return new Proxy(agent, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function" || typeof prop !== "string") {
        return value;
      }

      const toolName = prop;

      // Find a matching capability handle
      const handle = capabilities.find((cap) => {
        const tools = cap.allowedTools;
        return tools ? tools.includes(toolName) : false;
      });

      if (!handle) {
        return value;
      }

      return async function (this: unknown, ...args: unknown[]) {
        try {
          await handle.execute(toolName, undefined, defaultCategory ?? "other");
        } catch (err) {
          if (onDenied && err instanceof Error) {
            onDenied(err, toolName);
          }
          throw err;
        }
        return (value as (...a: unknown[]) => unknown).apply(this === receiver ? target : this, args);
      };
    },
  });
}
