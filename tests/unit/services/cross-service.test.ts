import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { crossServiceModule } from '../../../src/services/cross-service.js';
import { RadarrClient, SonarrClient } from '../../../src/clients/arr-client.js';
import { mswServer } from '../../setup.js';
import { systemStatusFixture } from '../../fixtures/shared/config.js';
import { searchResultFixtures } from '../../fixtures/radarr/movies.js';
import { seriesSearchResultFixtures } from '../../fixtures/sonarr/series.js';

const RADARR = 'http://radarr.test';
const SONARR = 'http://sonarr.test';

// ─── arr_status ───────────────────────────────────────────────────────────────

describe('arr_status', () => {
  it('reports each configured service as connected when reachable', async () => {
    mswServer.use(
      http.get(`${RADARR}/api/v3/system/status`, () => HttpResponse.json(systemStatusFixture)),
      http.get(`${SONARR}/api/v3/system/status`, () => HttpResponse.json({ ...systemStatusFixture, appName: 'Sonarr' })),
    );
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const sonarr = new SonarrClient({ url: SONARR, apiKey: 'k' });

    const result = await crossServiceModule.handlers['arr_status']({}, { radarr, sonarr });
    const data = JSON.parse(result.content[0].text);

    expect(data.radarr.configured).toBe(true);
    expect(data.radarr.connected).toBe(true);
    expect(data.radarr.version).toBe(systemStatusFixture.version);
    expect(data.sonarr.connected).toBe(true);
    expect(data.sonarr.appName).toBe('Sonarr');
  });

  it('reports connected: false when a service is unreachable', async () => {
    mswServer.use(
      http.get(`${RADARR}/api/v3/system/status`, () => HttpResponse.json({ error: 'Not found' }, { status: 503 })),
    );
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const result = await crossServiceModule.handlers['arr_status']({}, { radarr });
    const data = JSON.parse(result.content[0].text);

    expect(data.radarr.configured).toBe(true);
    expect(data.radarr.connected).toBe(false);
    expect(data.radarr).toHaveProperty('error');
  });

  it('only reports services that are configured in clients map', async () => {
    mswServer.use(
      http.get(`${RADARR}/api/v3/system/status`, () => HttpResponse.json(systemStatusFixture)),
    );
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    // sonarr NOT in clients
    const result = await crossServiceModule.handlers['arr_status']({}, { radarr });
    const data = JSON.parse(result.content[0].text);

    expect(data).toHaveProperty('radarr');
    expect(data).not.toHaveProperty('sonarr');
  });

  it('returns empty object when no services are configured', async () => {
    const result = await crossServiceModule.handlers['arr_status']({}, {});
    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual({});
  });
});

// ─── arr_search_all ───────────────────────────────────────────────────────────

describe('arr_search_all', () => {
  beforeEach(() => {
    mswServer.use(
      http.get(`${RADARR}/api/v3/movie/lookup`, () => HttpResponse.json(searchResultFixtures)),
      http.get(`${SONARR}/api/v3/series/lookup`, () => HttpResponse.json(seriesSearchResultFixtures)),
    );
  });

  it('returns results grouped by service', async () => {
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const sonarr = new SonarrClient({ url: SONARR, apiKey: 'k' });

    const result = await crossServiceModule.handlers['arr_search_all']({ term: 'dune' }, { radarr, sonarr });
    const data = JSON.parse(result.content[0].text);

    expect(data.term).toBe('dune');
    expect(data.results).toHaveProperty('radarr');
    expect(data.results).toHaveProperty('sonarr');
    expect(data.results.radarr.results[0]).toHaveProperty('tmdbId');
    expect(data.results.sonarr.results[0]).toHaveProperty('tvdbId');
  });

  it('limits results to 5 per service', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...searchResultFixtures[0], tmdbId: i + 1, title: `Film ${i}` }));
    mswServer.use(http.get(`${RADARR}/api/v3/movie/lookup`, () => HttpResponse.json(many)));
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });

    const result = await crossServiceModule.handlers['arr_search_all']({ term: 'film' }, { radarr });
    const data = JSON.parse(result.content[0].text);
    expect(data.results.radarr.results).toHaveLength(5);
  });

  it('truncates overviews to 150 chars', async () => {
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const result = await crossServiceModule.handlers['arr_search_all']({ term: 'dune' }, { radarr });
    const data = JSON.parse(result.content[0].text);
    for (const item of data.results.radarr.results) {
      if (item.overview) {
        expect((item.overview as string).length).toBeLessThanOrEqual(151); // 150 + ellipsis
      }
    }
  });

  it('skips a service if it throws, still returns results from others', async () => {
    // Radarr fails
    mswServer.use(http.get(`${RADARR}/api/v3/movie/lookup`, () => HttpResponse.json({}, { status: 500 })));
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const sonarr = new SonarrClient({ url: SONARR, apiKey: 'k' });

    const result = await crossServiceModule.handlers['arr_search_all']({ term: 'test' }, { radarr, sonarr });
    const data = JSON.parse(result.content[0].text);
    expect(data.results.radarr).toHaveProperty('error');
    expect(data.results.sonarr).toHaveProperty('results');
  });

  it('only queries services present in the clients map', async () => {
    const radarr = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const result = await crossServiceModule.handlers['arr_search_all']({ term: 'test' }, { radarr });
    const data = JSON.parse(result.content[0].text);

    expect(data.results).toHaveProperty('radarr');
    expect(data.results).not.toHaveProperty('sonarr');
    expect(data.results).not.toHaveProperty('lidarr');
  });
});
