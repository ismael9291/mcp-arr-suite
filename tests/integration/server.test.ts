/**
 * Integration tests: server dispatch
 *
 * Tests the full handler dispatch loop without starting an MCP transport.
 * Uses a real HandlerRegistry + real service modules + MSW HTTP mocks.
 *
 * Validates that:
 *   - dispatch routes to the correct handler end-to-end
 *   - errors from handlers surface as ToolResult with isError
 *   - unknown tool names throw (not silently swallowed)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HandlerRegistry } from '../../src/registry.js';
import { buildConfigModule } from '../../src/shared/config-tools.js';
import { radarrModule } from '../../src/services/radarr.js';
import { sonarrModule } from '../../src/services/sonarr.js';
import { crossServiceModule } from '../../src/services/cross-service.js';
import { trashModule } from '../../src/trash/tools.js';
import { RadarrClient, SonarrClient } from '../../src/clients/arr-client.js';
import { mswServer } from '../setup.js';
import { movieFixtures } from '../fixtures/radarr/movies.js';
import { seriesFixtures } from '../fixtures/sonarr/series.js';
import { systemStatusFixture } from '../fixtures/shared/config.js';

const RADARR = 'http://radarr.test';
const SONARR = 'http://sonarr.test';

function buildTestRegistry(radarr?: RadarrClient, sonarr?: SonarrClient) {
  const clients = { radarr, sonarr };
  const registry = new HandlerRegistry();
  registry.register(crossServiceModule);
  registry.register(trashModule);
  if (radarr) {
    registry.register(buildConfigModule('radarr', 'Radarr (Movies)'));
    registry.register(radarrModule);
  }
  if (sonarr) {
    registry.register(buildConfigModule('sonarr', 'Sonarr (TV)'));
    registry.register(sonarrModule);
  }
  return { registry, clients };
}

// ─── Dispatch routing ─────────────────────────────────────────────────────────

describe('registry dispatch routing', () => {
  it('routes radarr_get_movies to the radarr handler', async () => {
    mswServer.use(http.get(`${RADARR}/api/v3/movie`, () => HttpResponse.json(movieFixtures)));
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const { registry, clients } = buildTestRegistry(radarr);

    const result = await registry.dispatch('radarr_get_movies', {}, clients);
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(movieFixtures.length);
  });

  it('routes sonarr_get_series to the sonarr handler', async () => {
    mswServer.use(http.get(`${SONARR}/api/v3/series`, () => HttpResponse.json(seriesFixtures)));
    const sonarr = new SonarrClient({ url: SONARR, apiKey: 'k' });
    const { registry, clients } = buildTestRegistry(undefined, sonarr);

    const result = await registry.dispatch('sonarr_get_series', {}, clients);
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(seriesFixtures.length);
  });

  it('routes arr_status to the cross-service handler', async () => {
    mswServer.use(http.get(`${RADARR}/api/v3/system/status`, () => HttpResponse.json(systemStatusFixture)));
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const { registry, clients } = buildTestRegistry(radarr);

    const result = await registry.dispatch('arr_status', {}, clients);
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.radarr.connected).toBe(true);
  });

  it('throws for unknown tool names', async () => {
    const { registry, clients } = buildTestRegistry();
    await expect(registry.dispatch('this_does_not_exist', {}, clients)).rejects.toThrow(/Unknown tool/);
  });
});

// ─── Error surfacing ──────────────────────────────────────────────────────────

describe('handler errors surface correctly', () => {
  it('a handler that throws propagates through dispatch', async () => {
    // Radarr returns 500, which makes getMovies() throw
    mswServer.use(http.get(`${RADARR}/api/v3/movie`, () => new HttpResponse('Server Error', { status: 500 })));
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const { registry, clients } = buildTestRegistry(radarr);

    // dispatch() throws — callers (like index.ts) wrap this in a try/catch
    await expect(registry.dispatch('radarr_get_movies', {}, clients)).rejects.toThrow(/radarr API error.*500/i);
  });

  it('a handler that returns isError is surfaced as-is', async () => {
    // trash_compare_profile returns err() when the service client is absent
    const { registry, clients } = buildTestRegistry(); // no radarr client
    const result = await registry.dispatch('trash_compare_profile', {
      service: 'radarr', profileId: 4, trashProfile: 'uhd-bluray-web',
    }, clients);
    expect(result.isError).toBe(true);
  });
});

// ─── Tool isolation per configured service ────────────────────────────────────

describe('service isolation', () => {
  it('radarr tools are only dispatchable when radarr is registered', async () => {
    // sonarr-only registry
    const sonarr = new SonarrClient({ url: SONARR, apiKey: 'k' });
    const { registry, clients } = buildTestRegistry(undefined, sonarr);

    await expect(registry.dispatch('radarr_get_movies', {}, clients)).rejects.toThrow(/Unknown tool/);
  });

  it('sonarr tools are only dispatchable when sonarr is registered', async () => {
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const { registry, clients } = buildTestRegistry(radarr, undefined);

    await expect(registry.dispatch('sonarr_get_series', {}, clients)).rejects.toThrow(/Unknown tool/);
  });
});

// ─── Full round-trip: radarr + sonarr together ────────────────────────────────

describe('full round-trip with radarr + sonarr', () => {
  let registry: HandlerRegistry;
  let clients: ReturnType<typeof buildTestRegistry>['clients'];

  beforeEach(() => {
    mswServer.use(
      http.get(`${RADARR}/api/v3/movie`, () => HttpResponse.json(movieFixtures)),
      http.get(`${SONARR}/api/v3/series`, () => HttpResponse.json(seriesFixtures)),
      http.get(`${RADARR}/api/v3/system/status`, () => HttpResponse.json(systemStatusFixture)),
      http.get(`${SONARR}/api/v3/system/status`, () => HttpResponse.json({ ...systemStatusFixture, appName: 'Sonarr' })),
    );
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const sonarr = new SonarrClient({ url: SONARR, apiKey: 'k' });
    const result = buildTestRegistry(radarr, sonarr);
    registry = result.registry;
    clients = result.clients;
  });

  it('can dispatch radarr and sonarr tools from the same registry', async () => {
    const [moviesResult, seriesResult] = await Promise.all([
      registry.dispatch('radarr_get_movies', {}, clients),
      registry.dispatch('sonarr_get_series', {}, clients),
    ]);
    const movies = JSON.parse(moviesResult.content[0].text);
    const series = JSON.parse(seriesResult.content[0].text);
    expect(movies.total).toBe(movieFixtures.length);
    expect(series.total).toBe(seriesFixtures.length);
  });

  it('arr_status reports both services connected', async () => {
    const result = await registry.dispatch('arr_status', {}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.radarr.connected).toBe(true);
    expect(data.sonarr.connected).toBe(true);
    expect(data.sonarr.appName).toBe('Sonarr');
  });

  it('getTools returns tools for both services', () => {
    const names = registry.getTools().map(t => t.name);
    expect(names).toContain('radarr_get_movies');
    expect(names).toContain('sonarr_get_series');
    expect(names).toContain('arr_status');
    expect(names).toContain('trash_list_profiles');
  });
});
