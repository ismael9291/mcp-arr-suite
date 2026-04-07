import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { RadarrClient, SonarrClient, LidarrClient, ProwlarrClient } from '../../../src/clients/arr-client.js';
import { mswServer } from '../../setup.js';
import { systemStatusFixture, qualityProfileFixtures, tagFixtures } from '../../fixtures/shared/config.js';
import { movieFixtures } from '../../fixtures/radarr/movies.js';
import { seriesFixtures, episodeFixtures } from '../../fixtures/sonarr/series.js';

const RADARR = 'http://radarr.test';
const SONARR = 'http://sonarr.test';
const LIDARR = 'http://lidarr.test';
const PROWLARR = 'http://prowlarr.test';

// ─── URL construction and versioning ─────────────────────────────────────────

describe('API version per client type', () => {
  it('RadarrClient uses /api/v3/', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${RADARR}/api/v3/system/status`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json(systemStatusFixture);
    }));
    const client = new RadarrClient({ url: RADARR, apiKey: 'k' });
    await client.getStatus();
    expect(calledPath).toBe('/api/v3/system/status');
  });

  it('SonarrClient uses /api/v3/', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${SONARR}/api/v3/system/status`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json(systemStatusFixture);
    }));
    const client = new SonarrClient({ url: SONARR, apiKey: 'k' });
    await client.getStatus();
    expect(calledPath).toBe('/api/v3/system/status');
  });

  it('LidarrClient uses /api/v1/', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${LIDARR}/api/v1/system/status`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json(systemStatusFixture);
    }));
    const client = new LidarrClient({ url: LIDARR, apiKey: 'k' });
    await client.getStatus();
    expect(calledPath).toBe('/api/v1/system/status');
  });

  it('ProwlarrClient uses /api/v1/', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${PROWLARR}/api/v1/system/status`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json(systemStatusFixture);
    }));
    const client = new ProwlarrClient({ url: PROWLARR, apiKey: 'k' });
    await client.getStatus();
    expect(calledPath).toBe('/api/v1/system/status');
  });

  it('strips trailing slash from base URL', async () => {
    let calledUrl = '';
    mswServer.use(http.get(`${RADARR}/api/v3/system/status`, ({ request }) => {
      calledUrl = request.url;
      return HttpResponse.json(systemStatusFixture);
    }));
    const client = new RadarrClient({ url: `${RADARR}/`, apiKey: 'k' });
    await client.getStatus();
    // Should not have double slashes
    expect(calledUrl).not.toContain('//api');
  });
});

// ─── X-Api-Key header ─────────────────────────────────────────────────────────

describe('authentication header', () => {
  it('sends X-Api-Key header with every request', async () => {
    const apiKey = 'super-secret-key-123';
    let receivedKey = '';
    mswServer.use(http.get(`${RADARR}/api/v3/system/status`, ({ request }) => {
      receivedKey = request.headers.get('X-Api-Key') ?? '';
      return HttpResponse.json(systemStatusFixture);
    }));
    const client = new RadarrClient({ url: RADARR, apiKey });
    await client.getStatus();
    expect(receivedKey).toBe(apiKey);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('throws a descriptive error on non-ok HTTP status', async () => {
    mswServer.use(http.get(`${RADARR}/api/v3/system/status`, () =>
      new HttpResponse('Unauthorized', { status: 401, statusText: 'Unauthorized' })
    ));
    const client = new RadarrClient({ url: RADARR, apiKey: 'bad-key' });
    await expect(client.getStatus()).rejects.toThrow(/radarr API error.*401/i);
  });

  it('throws on 500 server error', async () => {
    mswServer.use(http.get(`${RADARR}/api/v3/movie`, () =>
      new HttpResponse('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
    ));
    const client = new RadarrClient({ url: RADARR, apiKey: 'k' });
    await expect(client.getMovies()).rejects.toThrow(/radarr API error.*500/i);
  });
});

// ─── RadarrClient methods ─────────────────────────────────────────────────────

describe('RadarrClient', () => {
  let client: RadarrClient;
  beforeAll(() => {
    client = new RadarrClient({ url: RADARR, apiKey: 'k' });
  });

  it('getMovies returns movie array', async () => {
    mswServer.use(http.get(`${RADARR}/api/v3/movie`, () => HttpResponse.json(movieFixtures)));
    const movies = await client.getMovies();
    expect(movies).toHaveLength(movieFixtures.length);
    expect(movies[0].title).toBe('Inception');
  });

  it('getMovieById returns single movie', async () => {
    mswServer.use(http.get(`${RADARR}/api/v3/movie/1`, () => HttpResponse.json(movieFixtures[0])));
    const movie = await client.getMovieById(1);
    expect(movie.id).toBe(1);
  });

  it('getQualityProfiles returns profiles', async () => {
    mswServer.use(http.get(`${RADARR}/api/v3/qualityprofile`, () => HttpResponse.json(qualityProfileFixtures)));
    const profiles = await client.getQualityProfiles();
    expect(profiles).toHaveLength(qualityProfileFixtures.length);
  });

  it('getTags returns tag list', async () => {
    mswServer.use(http.get(`${RADARR}/api/v3/tag`, () => HttpResponse.json(tagFixtures)));
    const tags = await client.getTags();
    expect(tags[0].label).toBe('hdr');
  });

  it('searchMovies sends query string', async () => {
    let calledParams = new URLSearchParams();
    mswServer.use(http.get(`${RADARR}/api/v3/movie/lookup`, ({ request }) => {
      calledParams = new URL(request.url).searchParams;
      return HttpResponse.json([]);
    }));
    await client.searchMovies('Dune');
    expect(calledParams.get('term')).toBe('Dune');
  });
});

// ─── SonarrClient methods ─────────────────────────────────────────────────────

describe('SonarrClient', () => {
  let client: SonarrClient;
  beforeAll(() => {
    client = new SonarrClient({ url: SONARR, apiKey: 'k' });
  });

  it('getSeries returns series array', async () => {
    mswServer.use(http.get(`${SONARR}/api/v3/series`, () => HttpResponse.json(seriesFixtures)));
    const series = await client.getSeries();
    expect(series).toHaveLength(seriesFixtures.length);
  });

  it('getSeriesById returns single series', async () => {
    mswServer.use(http.get(`${SONARR}/api/v3/series/1`, () => HttpResponse.json(seriesFixtures[0])));
    const s = await client.getSeriesById(1);
    expect(s.title).toBe('Breaking Bad');
  });

  it('getEpisodes sends seriesId and optional seasonNumber', async () => {
    let calledParams = new URLSearchParams();
    mswServer.use(http.get(`${SONARR}/api/v3/episode`, ({ request }) => {
      calledParams = new URL(request.url).searchParams;
      return HttpResponse.json(episodeFixtures);
    }));
    await client.getEpisodes(1, 2);
    expect(calledParams.get('seriesId')).toBe('1');
    expect(calledParams.get('seasonNumber')).toBe('2');
  });

  it('getEpisodes omits seasonNumber when not provided', async () => {
    let calledParams = new URLSearchParams();
    mswServer.use(http.get(`${SONARR}/api/v3/episode`, ({ request }) => {
      calledParams = new URL(request.url).searchParams;
      return HttpResponse.json(episodeFixtures);
    }));
    await client.getEpisodes(1);
    expect(calledParams.get('seriesId')).toBe('1');
    expect(calledParams.has('seasonNumber')).toBe(false);
  });
});

// ─── getCommandStatus ─────────────────────────────────────────────────────────

describe('getCommandStatus', () => {
  it('fetches command status from base class', async () => {
    const commandResponse = { id: 42, name: 'RescanMovie', status: 'completed', message: 'Done', started: '2024-01-01T00:00:00Z', ended: '2024-01-01T00:00:05Z' };
    mswServer.use(http.get(`${RADARR}/api/v3/command/42`, () => HttpResponse.json(commandResponse)));
    const client = new RadarrClient({ url: RADARR, apiKey: 'k' });
    const result = await client.getCommandStatus(42);
    expect(result.id).toBe(42);
    expect(result.name).toBe('RescanMovie');
    expect(result.status).toBe('completed');
  });

  it('works from SonarrClient (inherited from base)', async () => {
    const commandResponse = { id: 5, name: 'RefreshSeries', status: 'started', message: 'Running' };
    mswServer.use(http.get(`${SONARR}/api/v3/command/5`, () => HttpResponse.json(commandResponse)));
    const client = new SonarrClient({ url: SONARR, apiKey: 'k' });
    const result = await client.getCommandStatus(5);
    expect(result.status).toBe('started');
  });
});

// ─── SonarrClient new methods ─────────────────────────────────────────────────

describe('SonarrClient bulk and rescan methods', () => {
  let client: SonarrClient;
  beforeAll(() => { client = new SonarrClient({ url: SONARR, apiKey: 'k' }); });

  it('rescanAllSeries posts RescanSeries command', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.post(`${SONARR}/api/v3/command`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 100 });
    }));
    const result = await client.rescanAllSeries();
    expect(result.id).toBe(100);
    expect(body['name']).toBe('RescanSeries');
  });

  it('refreshSeries with no args omits seriesId from body', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.post(`${SONARR}/api/v3/command`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 101 });
    }));
    await client.refreshSeries();
    expect(body['name']).toBe('RefreshSeries');
    expect(body).not.toHaveProperty('seriesId');
  });

  it('refreshSeries with seriesId includes it in body', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.post(`${SONARR}/api/v3/command`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 102 });
    }));
    await client.refreshSeries(1);
    expect(body['seriesId']).toBe(1);
  });

  it('bulkUpdateSeries sends PUT to /series/editor', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.put(`${SONARR}/api/v3/series/editor`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return new HttpResponse(null, { status: 204 });
    }));
    await client.bulkUpdateSeries([1, 2], { monitored: false });
    expect(body['seriesIds']).toEqual([1, 2]);
    expect(body['monitored']).toBe(false);
  });

  it('bulkDeleteSeries sends DELETE to /series/editor', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.delete(`${SONARR}/api/v3/series/editor`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return new HttpResponse(null, { status: 204 });
    }));
    await client.bulkDeleteSeries([3], true, false);
    expect(body['seriesIds']).toEqual([3]);
    expect(body['deleteFiles']).toBe(true);
  });

  it('getManualImport sends correct query params', async () => {
    let params = new URLSearchParams();
    mswServer.use(http.get(`${SONARR}/api/v3/manualimport`, ({ request }) => {
      params = new URL(request.url).searchParams;
      return HttpResponse.json([]);
    }));
    await client.getManualImport('/downloads', false, 2, 25);
    expect(params.get('folder')).toBe('/downloads');
    expect(params.get('filterExistingFiles')).toBe('false');
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('25');
  });

  it('processManualImport posts items to /manualimport', async () => {
    let receivedBody: unknown = null;
    mswServer.use(http.post(`${SONARR}/api/v3/manualimport`, async ({ request }) => {
      receivedBody = await request.json();
      return new HttpResponse(null, { status: 204 });
    }));
    const items = [{ id: 1, path: '/x.mkv', relativePath: 'x.mkv', folderName: '', name: 'x', size: 0, quality: { quality: { name: 'HDTV' }, revision: { version: 1 } }, rejections: [] }];
    await client.processManualImport(items as import('../../../src/clients/arr-client.js').ManualImportItem[]);
    expect(Array.isArray(receivedBody)).toBe(true);
  });
});

// ─── RadarrClient new methods ─────────────────────────────────────────────────

describe('RadarrClient bulk and rescan methods', () => {
  let client: RadarrClient;
  beforeAll(() => { client = new RadarrClient({ url: RADARR, apiKey: 'k' }); });

  it('rescanAllMovies posts RescanMovie command', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.post(`${RADARR}/api/v3/command`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 200 });
    }));
    const result = await client.rescanAllMovies();
    expect(result.id).toBe(200);
    expect(body['name']).toBe('RescanMovie');
  });

  it('refreshMovie with no args omits movieIds from body', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.post(`${RADARR}/api/v3/command`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 201 });
    }));
    await client.refreshMovie();
    expect(body['name']).toBe('RefreshMovie');
    expect(body).not.toHaveProperty('movieIds');
  });

  it('refreshMovie with movieId wraps it in array', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.post(`${RADARR}/api/v3/command`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 202 });
    }));
    await client.refreshMovie(5);
    expect(body['movieIds']).toEqual([5]);
  });

  it('bulkUpdateMovies sends PUT to /movie/editor', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.put(`${RADARR}/api/v3/movie/editor`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return new HttpResponse(null, { status: 204 });
    }));
    await client.bulkUpdateMovies([1, 2, 3], { monitored: true, qualityProfileId: 4 });
    expect(body['movieIds']).toEqual([1, 2, 3]);
    expect(body['monitored']).toBe(true);
    expect(body['qualityProfileId']).toBe(4);
  });

  it('bulkDeleteMovies sends DELETE to /movie/editor', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.delete(`${RADARR}/api/v3/movie/editor`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return new HttpResponse(null, { status: 204 });
    }));
    await client.bulkDeleteMovies([7, 8], false, true);
    expect(body['movieIds']).toEqual([7, 8]);
    expect(body['addImportExclusion']).toBe(true);
  });
});

// ─── LidarrClient import exclusion methods ────────────────────────────────────

describe('LidarrClient import exclusions', () => {
  let client: LidarrClient;
  beforeAll(() => { client = new LidarrClient({ url: LIDARR, apiKey: 'k' }); });

  it('getImportExclusions fetches from /api/v1/importlistexclusion', async () => {
    const exclusions = [{ id: 1, title: 'Old Band', year: 2010 }];
    mswServer.use(http.get(`${LIDARR}/api/v1/importlistexclusion`, () => HttpResponse.json(exclusions)));
    const result = await client.getImportExclusions();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Old Band');
  });

  it('deleteImportExclusion sends DELETE to correct endpoint', async () => {
    let calledPath = '';
    mswServer.use(http.delete(`${LIDARR}/api/v1/importlistexclusion/5`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return new HttpResponse(null, { status: 204 });
    }));
    await client.deleteImportExclusion(5);
    expect(calledPath).toBe('/api/v1/importlistexclusion/5');
  });
});

// ─── Import: beforeAll ────────────────────────────────────────────────────────

function beforeAll(fn: () => void) {
  // vitest's beforeAll is available globally in the test file via globals: true config
  // Putting it here as a simple setup call instead
  fn();
}
