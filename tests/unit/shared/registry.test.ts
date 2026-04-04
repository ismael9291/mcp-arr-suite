import { describe, it, expect, vi } from 'vitest';
import { HandlerRegistry } from '../../../src/registry.js';
import type { ToolModule, ClientMap } from '../../../src/types.js';

const emptyClients: ClientMap = {};

function makeModule(names: string[], returnVal = 'ok'): ToolModule {
  const tools = names.map(name => ({
    name,
    description: `Tool ${name}`,
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  }));
  const handlers: ToolModule['handlers'] = {};
  for (const name of names) {
    handlers[name] = vi.fn().mockResolvedValue({
      content: [{ type: 'text' as const, text: returnVal }],
    });
  }
  return { tools, handlers };
}

describe('HandlerRegistry.register', () => {
  it('registers tools from a module', () => {
    const registry = new HandlerRegistry();
    registry.register(makeModule(['tool_a', 'tool_b']));
    const names = registry.getTools().map(t => t.name);
    expect(names).toContain('tool_a');
    expect(names).toContain('tool_b');
  });

  it('preserves registration order across multiple modules', () => {
    const registry = new HandlerRegistry();
    registry.register(makeModule(['first']));
    registry.register(makeModule(['second']));
    registry.register(makeModule(['third']));
    const names = registry.getTools().map(t => t.name);
    expect(names).toEqual(['first', 'second', 'third']);
  });

  it('throws on duplicate tool name', () => {
    const registry = new HandlerRegistry();
    registry.register(makeModule(['shared_name']));
    expect(() => registry.register(makeModule(['shared_name']))).toThrow(
      /Duplicate tool registration.*shared_name/
    );
  });

  it('throws on duplicate name even across different modules', () => {
    const registry = new HandlerRegistry();
    registry.register(makeModule(['tool_x', 'tool_y']));
    expect(() => registry.register(makeModule(['tool_z', 'tool_x']))).toThrow(
      /Duplicate tool registration.*tool_x/
    );
  });

  it('does not partially register on duplicate — already-registered tools remain', () => {
    const registry = new HandlerRegistry();
    registry.register(makeModule(['tool_a']));
    try {
      registry.register(makeModule(['tool_a']));
    } catch {
      // expected
    }
    // tool_a was registered before the collision — it should still be there
    expect(registry.getTools().map(t => t.name)).toContain('tool_a');
  });
});

describe('HandlerRegistry.getTools', () => {
  it('returns an empty array when nothing is registered', () => {
    const registry = new HandlerRegistry();
    expect(registry.getTools()).toEqual([]);
  });

  it('returns all tools in insertion order', () => {
    const registry = new HandlerRegistry();
    registry.register(makeModule(['a', 'b']));
    registry.register(makeModule(['c']));
    expect(registry.getTools().map(t => t.name)).toEqual(['a', 'b', 'c']);
  });
});

describe('HandlerRegistry.dispatch', () => {
  it('calls the correct handler for the tool name', async () => {
    const registry = new HandlerRegistry();
    const mod = makeModule(['my_tool']);
    registry.register(mod);
    const result = await registry.dispatch('my_tool', {}, emptyClients);
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'ok' });
    expect(mod.handlers['my_tool']).toHaveBeenCalledOnce();
  });

  it('passes args and clients to the handler', async () => {
    const registry = new HandlerRegistry();
    const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '' }] });
    const mod: ToolModule = {
      tools: [{ name: 'tool', description: '', inputSchema: { type: 'object', properties: {}, required: [] } }],
      handlers: { tool: handler },
    };
    registry.register(mod);
    const args = { limit: 10 };
    const clients = { radarr: undefined };
    await registry.dispatch('tool', args, clients);
    expect(handler).toHaveBeenCalledWith(args, clients);
  });

  it('throws for unknown tool names', async () => {
    const registry = new HandlerRegistry();
    await expect(registry.dispatch('nonexistent', {}, emptyClients)).rejects.toThrow(
      /Unknown tool.*nonexistent/
    );
  });
});
