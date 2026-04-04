/**
 * Integration tests: tool registration
 *
 * Verifies that:
 *   - All tool names are unique across the full registry
 *   - Every registered tool has a valid MCP schema (via Zod)
 *   - Tools are only registered when the corresponding service is configured
 *   - Cross-service + TRaSH tools are always present regardless of clients
 *
 * This test directly exercises the same registration logic used by index.ts,
 * but without spawning a server process.
 */

import { describe, it, expect } from 'vitest';
import { HandlerRegistry } from '../../src/registry.js';
import { buildConfigModule } from '../../src/shared/config-tools.js';
import { sonarrModule } from '../../src/services/sonarr.js';
import { radarrModule } from '../../src/services/radarr.js';
import { lidarrModule } from '../../src/services/lidarr.js';
import { prowlarrModule } from '../../src/services/prowlarr.js';
import { crossServiceModule } from '../../src/services/cross-service.js';
import { trashModule } from '../../src/trash/tools.js';

// ─── Schema validator (manual, avoids Zod v4 quirks with unknown value types) ─

function validateTool(tool: unknown): string | null {
  if (typeof tool !== 'object' || tool === null) return 'not an object';
  const t = tool as Record<string, unknown>;
  if (typeof t['name'] !== 'string' || t['name'].trim() === '') return 'name missing or empty';
  if (typeof t['description'] !== 'string' || t['description'].trim() === '') return 'description missing or empty';
  const schema = t['inputSchema'];
  if (typeof schema !== 'object' || schema === null) return 'inputSchema missing';
  const s = schema as Record<string, unknown>;
  if (s['type'] !== 'object') return `inputSchema.type is "${s['type']}", expected "object"`;
  if ('required' in s && !Array.isArray(s['required'])) return 'inputSchema.required must be an array';
  return null; // valid
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFullRegistry() {
  const registry = new HandlerRegistry();
  registry.register(crossServiceModule);
  registry.register(trashModule);
  registry.register(buildConfigModule('sonarr', 'Sonarr (TV)'));
  registry.register(sonarrModule);
  registry.register(buildConfigModule('radarr', 'Radarr (Movies)'));
  registry.register(radarrModule);
  registry.register(buildConfigModule('lidarr', 'Lidarr (Music)'));
  registry.register(lidarrModule);
  registry.register(prowlarrModule);
  return registry;
}

// ─── Tool name uniqueness ─────────────────────────────────────────────────────

describe('tool name uniqueness', () => {
  it('has no duplicate tool names in the full registry', () => {
    const registry = buildFullRegistry();
    const names = registry.getTools().map(t => t.name);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });

  it('HandlerRegistry throws immediately on duplicate registration', () => {
    const registry = new HandlerRegistry();
    registry.register(crossServiceModule);
    expect(() => registry.register(crossServiceModule)).toThrow(/Duplicate tool registration/);
  });
});

// ─── Schema validity ──────────────────────────────────────────────────────────

describe('tool schema validity', () => {
  it('every tool passes schema validation', () => {
    const registry = buildFullRegistry();
    const tools = registry.getTools();
    expect(tools.length).toBeGreaterThan(0);

    for (const tool of tools) {
      const error = validateTool(tool);
      if (error) {
        throw new Error(`Tool "${(tool as { name?: string }).name}" failed validation: ${error}`);
      }
    }
  });

  it('every tool has a non-empty description', () => {
    const registry = buildFullRegistry();
    for (const tool of registry.getTools()) {
      expect(tool.description.trim().length, `Tool "${tool.name}" has empty description`).toBeGreaterThan(0);
    }
  });

  it('inputSchema.type is always "object"', () => {
    const registry = buildFullRegistry();
    for (const tool of registry.getTools()) {
      expect(tool.inputSchema.type, `Tool "${tool.name}" has non-object inputSchema.type`).toBe('object');
    }
  });
});

// ─── Conditional registration ─────────────────────────────────────────────────

describe('conditional tool registration by service', () => {
  function radarrOnlyRegistry() {
    const r = new HandlerRegistry();
    r.register(crossServiceModule);
    r.register(trashModule);
    r.register(buildConfigModule('radarr', 'Radarr (Movies)'));
    r.register(radarrModule);
    return r;
  }

  function sonarrOnlyRegistry() {
    const r = new HandlerRegistry();
    r.register(crossServiceModule);
    r.register(trashModule);
    r.register(buildConfigModule('sonarr', 'Sonarr (TV)'));
    r.register(sonarrModule);
    return r;
  }

  it('radarr tools appear when radarr is configured', () => {
    const r = radarrOnlyRegistry();
    const names = r.getTools().map(t => t.name);
    expect(names).toContain('radarr_get_movies');
    expect(names).toContain('radarr_get_quality_profiles');
    expect(names).toContain('radarr_review_setup');
  });

  it('sonarr tools do NOT appear when only radarr is configured', () => {
    const r = radarrOnlyRegistry();
    const names = r.getTools().map(t => t.name);
    expect(names).not.toContain('sonarr_get_series');
    expect(names).not.toContain('sonarr_get_quality_profiles');
  });

  it('sonarr tools appear when sonarr is configured', () => {
    const r = sonarrOnlyRegistry();
    const names = r.getTools().map(t => t.name);
    expect(names).toContain('sonarr_get_series');
    expect(names).toContain('sonarr_get_episodes');
  });

  it('radarr tools do NOT appear when only sonarr is configured', () => {
    const r = sonarrOnlyRegistry();
    const names = r.getTools().map(t => t.name);
    expect(names).not.toContain('radarr_get_movies');
    expect(names).not.toContain('radarr_add_movie');
  });

  it('lidarr tools appear when lidarr is configured', () => {
    const r = new HandlerRegistry();
    r.register(crossServiceModule);
    r.register(trashModule);
    r.register(buildConfigModule('lidarr', 'Lidarr'));
    r.register(lidarrModule);
    const names = r.getTools().map(t => t.name);
    expect(names).toContain('lidarr_get_artists');
    expect(names).toContain('lidarr_get_quality_profiles');
  });

  it('prowlarr tools appear when prowlarr is configured (no buildConfigModule)', () => {
    const r = new HandlerRegistry();
    r.register(crossServiceModule);
    r.register(trashModule);
    r.register(prowlarrModule);
    const names = r.getTools().map(t => t.name);
    expect(names).toContain('prowlarr_get_indexers');
    // Prowlarr intentionally doesn't have _get_quality_profiles
    expect(names).not.toContain('prowlarr_get_quality_profiles');
  });
});

// ─── Always-present tools ─────────────────────────────────────────────────────

describe('always-present tools (cross-service + TRaSH)', () => {
  it('arr_status and arr_search_all are always registered', () => {
    for (const registry of [
      (() => { const r = new HandlerRegistry(); r.register(crossServiceModule); r.register(trashModule); return r; })(),
      buildFullRegistry(),
    ]) {
      const names = registry.getTools().map(t => t.name);
      expect(names).toContain('arr_status');
      expect(names).toContain('arr_search_all');
    }
  });

  it('all 7 TRaSH tools are always registered', () => {
    const r = new HandlerRegistry();
    r.register(crossServiceModule);
    r.register(trashModule);
    const names = r.getTools().map(t => t.name);
    expect(names).toContain('trash_list_profiles');
    expect(names).toContain('trash_get_profile');
    expect(names).toContain('trash_list_custom_formats');
    expect(names).toContain('trash_get_naming');
    expect(names).toContain('trash_get_quality_sizes');
    expect(names).toContain('trash_compare_profile');
    expect(names).toContain('trash_compare_naming');
  });
});

// ─── Tool count sanity checks ─────────────────────────────────────────────────

describe('expected tool counts', () => {
  it('full registry has expected number of tools', () => {
    const registry = buildFullRegistry();
    const total = registry.getTools().length;
    // cross-service: 2, trash: 7, sonarr config: 7, sonarr: 22,
    // radarr config: 7, radarr: 18, lidarr config: 7, lidarr: 9, prowlarr: 5
    // = 84 total
    expect(total).toBeGreaterThan(60);
    expect(total).toBeLessThan(200);
  });

  it('buildConfigModule always generates exactly 7 tools', () => {
    for (const service of ['sonarr', 'radarr', 'lidarr'] as const) {
      const mod = buildConfigModule(service, 'Test');
      expect(mod.tools.length).toBe(7);
    }
  });
});
