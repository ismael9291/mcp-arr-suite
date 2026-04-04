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

// ─── Import: beforeAll ────────────────────────────────────────────────────────

function beforeAll(fn: () => void) {
  // vitest's beforeAll is available globally in the test file via globals: true config
  // Putting it here as a simple setup call instead
  fn();
}
