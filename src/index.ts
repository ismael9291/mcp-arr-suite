#!/usr/bin/env node
/**
 * mcp-arr-suite — MCP Server for the *arr Media Management Suite
 *
 * Supports: Sonarr (TV), Radarr (Movies), Lidarr (Music), Prowlarr (Indexers)
 *
 * Configuration via environment variables:
 *   SONARR_URL, SONARR_API_KEY
 *   RADARR_URL, RADARR_API_KEY
 *   LIDARR_URL, LIDARR_API_KEY
 *   PROWLARR_URL, PROWLARR_API_KEY
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { SonarrClient, RadarrClient, LidarrClient, ProwlarrClient } from './clients/arr-client.js';
import type { ClientMap } from './types.js';
import { HandlerRegistry } from './registry.js';
import { buildConfigModule } from './shared/config-tools.js';
import { sonarrModule } from './services/sonarr.js';
import { radarrModule } from './services/radarr.js';
import { lidarrModule } from './services/lidarr.js';
import { prowlarrModule } from './services/prowlarr.js';
import { crossServiceModule } from './services/cross-service.js';
import { trashModule } from './trash/tools.js';

// ─── Build client map from environment ───────────────────────────────────────

const clients: ClientMap = {};

if (process.env.SONARR_URL && process.env.SONARR_API_KEY) {
  clients.sonarr = new SonarrClient({ url: process.env.SONARR_URL, apiKey: process.env.SONARR_API_KEY });
}
if (process.env.RADARR_URL && process.env.RADARR_API_KEY) {
  clients.radarr = new RadarrClient({ url: process.env.RADARR_URL, apiKey: process.env.RADARR_API_KEY });
}
if (process.env.LIDARR_URL && process.env.LIDARR_API_KEY) {
  clients.lidarr = new LidarrClient({ url: process.env.LIDARR_URL, apiKey: process.env.LIDARR_API_KEY });
}
if (process.env.PROWLARR_URL && process.env.PROWLARR_API_KEY) {
  clients.prowlarr = new ProwlarrClient({ url: process.env.PROWLARR_URL, apiKey: process.env.PROWLARR_API_KEY });
}

if (Object.keys(clients).length === 0) {
  console.error('Error: No *arr services configured.');
  console.error('Set at least one pair of URL and API_KEY env vars (e.g. RADARR_URL + RADARR_API_KEY).');
  process.exit(1);
}

// ─── Register modules ─────────────────────────────────────────────────────────

const registry = new HandlerRegistry();

// Cross-service and TRaSH tools are always registered
registry.register(crossServiceModule);
registry.register(trashModule);

// Service modules registered only if the service is configured
if (clients.sonarr) {
  registry.register(buildConfigModule('sonarr', 'Sonarr (TV)'));
  registry.register(sonarrModule);
}
if (clients.radarr) {
  registry.register(buildConfigModule('radarr', 'Radarr (Movies)'));
  registry.register(radarrModule);
}
if (clients.lidarr) {
  registry.register(buildConfigModule('lidarr', 'Lidarr (Music)'));
  registry.register(lidarrModule);
}
if (clients.prowlarr) {
  registry.register(prowlarrModule);
}

// ─── MCP server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'mcp-arr-suite', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: registry.getTools(),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await registry.dispatch(name, (args ?? {}) as Record<string, unknown>, clients);
    return result as never;
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    } as never;
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`mcp-arr-suite running — services: ${Object.keys(clients).join(', ')}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
