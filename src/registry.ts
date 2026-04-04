import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ClientMap, HandlerFn, ToolModule, ToolResult } from './types.js';

/**
 * HandlerRegistry replaces the monolithic switch statement.
 *
 * Modules self-register; dispatch is a plain map lookup.
 * Duplicate tool names throw at startup — caught immediately, not at runtime.
 */
export class HandlerRegistry {
  private readonly tools: Tool[] = [];
  private readonly handlers = new Map<string, HandlerFn>();

  register(module: ToolModule): void {
    for (const tool of module.tools) {
      this.tools.push(tool);
    }
    for (const [name, fn] of Object.entries(module.handlers)) {
      if (this.handlers.has(name)) {
        throw new Error(`Duplicate tool registration: "${name}". Each tool name must be unique.`);
      }
      this.handlers.set(name, fn);
    }
  }

  getTools(): Tool[] {
    return this.tools;
  }

  async dispatch(
    toolName: string,
    args: Record<string, unknown>,
    clients: ClientMap
  ): Promise<ToolResult> {
    const handler = this.handlers.get(toolName);
    if (!handler) {
      throw new Error(`Unknown tool: "${toolName}"`);
    }
    return handler(args, clients);
  }
}
