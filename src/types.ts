import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type {
  SonarrClient,
  RadarrClient,
  LidarrClient,
  ProwlarrClient,
} from './clients/arr-client.js';

// ─── Client map ───────────────────────────────────────────────────────────────

/** Sparse map of configured service clients. Only present if env vars are set. */
export interface ClientMap {
  sonarr?: SonarrClient;
  radarr?: RadarrClient;
  lidarr?: LidarrClient;
  prowlarr?: ProwlarrClient;
}

// ─── Handler types ────────────────────────────────────────────────────────────

/** MCP tool response content */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/** Every tool handler has this exact signature */
export type HandlerFn = (
  args: Record<string, unknown>,
  clients: ClientMap
) => Promise<ToolResult>;

// ─── Module contract ──────────────────────────────────────────────────────────

/**
 * A self-contained unit that bundles tool definitions with their handlers.
 * Tool schemas and handler logic live together — add a tool, add its handler
 * in the same file.
 */
export interface ToolModule {
  tools: Tool[];
  handlers: Record<string, HandlerFn>;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Convenience builder for a plain text success response */
export function ok(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/** Convenience builder for a plain text error response */
export function err(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}
