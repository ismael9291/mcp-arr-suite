import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { radarrModule } from '../../../src/services/radarr.js';
import { RadarrClient } from '../../../src/clients/arr-client.js';
import { mswServer } from '../../setup.js';
import { movieFixtures, historyFixture, blocklistFixture, wantedMissingFixture, searchResultFixtures, movieFileFixture, radarrImportExclusionFixtures, releaseFixtures } from '../../fixtures/radarr/movies.js';
import { qualityProfileFixtures, customFormatFixtures, tagFixtures, systemTaskFixtures, logPageFixture, notificationFixtures, qualityDefinitionFixtures, importListFixtures } from '../../fixtures/shared/config.js';

const BASE = 'http://radarr.test';
const KEY = 'test-key';
const API = `${BASE}/api/v3`;

let radarrClient: RadarrClient;
let clients: { radarr: RadarrClient };

beforeEach(() => {
  radarrClient = new RadarrClient({ url: BASE, apiKey: KEY });
  clients = { radarr: radarrClient };
});

// ─── radarr_get_movies ───────────────────────────────────────────────────────

describe('radarr_get_movies', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/movie`, () => HttpResponse.json(movieFixtures)));
  });

  it('returns paginated results', async () => {
    const result = await radarrModule.handlers['radarr_get_movies']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(movieFixtures.length);
    expect(data.returned).toBe(movieFixtures.length);
    expect(data.items).toHaveLength(movieFixtures.length);
  });

  it('returns summary fields only — not raw API fields', async () => {
    const result = await radarrModule.handlers['radarr_get_movies']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const item = data.items[0];
    // Expected summary fields
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('year');
    expect(item).toHaveProperty('hasFile');
    expect(item).toHaveProperty('monitored');
    // Raw fields that should be stripped
    expect(item).not.toHaveProperty('overview');
    expect(item).not.toHaveProperty('imdbId');
    expect(item).not.toHaveProperty('movieFile');
    expect(item).not.toHaveProperty('genres');
  });

  it('formats sizeOnDisk as human-readable', async () => {
    const result = await radarrModule.handlers['radarr_get_movies']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0].sizeOnDisk).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
  });

  it('filters by search term (case-insensitive)', async () => {
    const result = await radarrModule.handlers['radarr_get_movies']({ search: 'inception' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items.every((m: { title: string }) => m.title.toLowerCase().includes('inception'))).toBe(true);
    expect(data.search).toBe('inception');
  });

  it('paginates with limit and offset', async () => {
    const result = await radarrModule.handlers['radarr_get_movies']({ limit: 1, offset: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.returned).toBe(1);
    expect(data.offset).toBe(1);
    expect(data.items[0].title).toBe(movieFixtures[1].title);
  });

  it('clamps limit to max 100', async () => {
    const result = await radarrModule.handlers['radarr_get_movies']({ limit: 999 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.limit).toBe(100);
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_get_movies']({}, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_search ───────────────────────────────────────────────────────────

describe('radarr_search', () => {
  it('returns trimmed search results with truncated overview', async () => {
    mswServer.use(http.get(`${API}/movie/lookup`, () => HttpResponse.json(searchResultFixtures)));
    const result = await radarrModule.handlers['radarr_search']({ term: 'Dune' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(searchResultFixtures.length);
    expect(data.results[0]).toHaveProperty('tmdbId');
    expect(data.results[0]).toHaveProperty('title');
    // Overview should be truncated to 200 chars max
    const overview = data.results[0].overview as string | undefined;
    if (overview) expect(overview.length).toBeLessThanOrEqual(201); // 200 + ellipsis char
  });

  it('limits results to 10 even if API returns more', async () => {
    const manyResults = Array.from({ length: 20 }, (_, i) => ({ ...searchResultFixtures[0], tmdbId: i + 1, title: `Movie ${i}` }));
    mswServer.use(http.get(`${API}/movie/lookup`, () => HttpResponse.json(manyResults)));
    const result = await radarrModule.handlers['radarr_search']({ term: 'Movie' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(10);
  });
});

// ─── radarr_get_queue ────────────────────────────────────────────────────────

describe('radarr_get_queue', () => {
  const queueResponse = {
    totalRecords: 2,
    records: [
      { title: 'Movie A', status: 'downloading', size: 1000, sizeleft: 400, timeleft: '00:10:00', downloadClient: 'SABnzbd' },
      { title: 'Movie B', status: 'paused', size: 2000, sizeleft: 2000, timeleft: null, downloadClient: 'SABnzbd' },
    ],
  };

  beforeEach(() => {
    mswServer.use(http.get(`${API}/queue`, () => HttpResponse.json(queueResponse)));
  });

  it('returns queue items', async () => {
    const result = await radarrModule.handlers['radarr_get_queue']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(2);
    expect(data.items[0].title).toBe('Movie A');
  });

  it('formats download progress as percentage', async () => {
    const result = await radarrModule.handlers['radarr_get_queue']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0].progress).toBe('60.0%');
  });

  it('shows 0% progress for items with no size', async () => {
    const zeroSize = { totalRecords: 1, records: [{ title: 'X', status: 'queued', size: 0, sizeleft: 0, timeleft: null, downloadClient: 'SAB' }] };
    mswServer.use(http.get(`${API}/queue`, () => HttpResponse.json(zeroSize)));
    const result = await radarrModule.handlers['radarr_get_queue']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0].progress).toBe('0%');
  });

  it('respects limit argument', async () => {
    const result = await radarrModule.handlers['radarr_get_queue']({ limit: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items).toHaveLength(1);
  });
});

// ─── radarr_add_movie ────────────────────────────────────────────────────────

describe('radarr_add_movie', () => {
  it('returns success with id and path', async () => {
    const added = { id: 99, title: 'Dune: Part Two', year: 2024, path: '/movies/Dune Part Two (2024)', monitored: true };
    mswServer.use(http.post(`${API}/movie`, () => HttpResponse.json(added, { status: 201 })));
    const result = await radarrModule.handlers['radarr_add_movie']({
      tmdbId: 693134, title: 'Dune: Part Two', qualityProfileId: 4, rootFolderPath: '/movies',
    }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.id).toBe(99);
    expect(data.path).toBe('/movies/Dune Part Two (2024)');
  });
});

// ─── radarr_delete_movie ─────────────────────────────────────────────────────

describe('radarr_delete_movie', () => {
  it('returns success message with movie title', async () => {
    mswServer.use(
      http.get(`${API}/movie/1`, () => HttpResponse.json(movieFixtures[0])),
      http.delete(`${API}/movie/1`, () => HttpResponse.json({})),
    );
    const result = await radarrModule.handlers['radarr_delete_movie']({ movieId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.deletedFiles).toBe(false);
  });
});

// ─── radarr_get_history ───────────────────────────────────────────────────────

describe('radarr_get_history', () => {
  it('handles paged history response', async () => {
    const paged = { records: historyFixture, totalRecords: 1, page: 1, pageSize: 20, sortKey: 'date', sortDirection: 'descending' };
    mswServer.use(http.get(`${API}/history`, () => HttpResponse.json(paged)));
    const result = await radarrModule.handlers['radarr_get_history']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(1);
    expect(data.records[0].eventType).toBe('downloadFolderImported');
  });

  it('handles array history response (movie-specific)', async () => {
    mswServer.use(http.get(`${API}/history/movie`, () => HttpResponse.json(historyFixture)));
    const result = await radarrModule.handlers['radarr_get_history']({ movieId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.movieId).toBe(1);
    expect(data.records).toHaveLength(historyFixture.length);
  });
});

// ─── radarr_remove_from_queue ─────────────────────────────────────────────────

describe('radarr_remove_from_queue', () => {
  it('uses single DELETE for one id', async () => {
    let calledUrl = '';
    mswServer.use(http.delete(`${API}/queue/:id`, ({ params }) => {
      calledUrl = params['id'] as string;
      return HttpResponse.json({});
    }));
    const result = await radarrModule.handlers['radarr_remove_from_queue']({ ids: [42] }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(calledUrl).toBe('42');
  });

  it('uses bulk DELETE for multiple ids', async () => {
    let bulkCalled = false;
    mswServer.use(http.delete(`${API}/queue/bulk`, () => {
      bulkCalled = true;
      return HttpResponse.json({});
    }));
    const result = await radarrModule.handlers['radarr_remove_from_queue']({ ids: [1, 2, 3] }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(bulkCalled).toBe(true);
  });
});

// ─── radarr_get_wanted_missing ────────────────────────────────────────────────

describe('radarr_get_wanted_missing', () => {
  it('returns paged wanted missing list', async () => {
    mswServer.use(http.get(`${API}/wanted/missing`, () => HttpResponse.json(wantedMissingFixture)));
    const result = await radarrModule.handlers['radarr_get_wanted_missing']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(wantedMissingFixture.totalRecords);
    expect(data.movies[0]).toHaveProperty('id');
    expect(data.movies[0]).not.toHaveProperty('overview');
  });
});

// ─── radarr_get_movie_files ───────────────────────────────────────────────────

describe('radarr_get_movie_files', () => {
  it('returns file details with human-readable size', async () => {
    mswServer.use(http.get(`${API}/moviefile`, () => HttpResponse.json([movieFileFixture])));
    const result = await radarrModule.handlers['radarr_get_movie_files']({ movieId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(1);
    expect(data.files[0].size).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
    expect(data.files[0].quality).toBe('Remux-2160p');
    expect(data.files[0].videoCodec).toBe('HEVC');
  });
});

// ─── radarr_get_blocklist ─────────────────────────────────────────────────────

describe('radarr_get_blocklist', () => {
  it('handles paged blocklist response', async () => {
    const paged = { records: blocklistFixture, totalRecords: 1, page: 1, pageSize: 20 };
    // RadarrClient.getBlocklist calls /blocklist/movie (Radarr-specific endpoint)
    mswServer.use(http.get(`${API}/blocklist/movie`, () => HttpResponse.json(paged)));
    const result = await radarrModule.handlers['radarr_get_blocklist']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(1);
    expect(data.entries[0].sourceTitle).toBe(blocklistFixture[0].sourceTitle);
    expect(data.entries[0].message).toBe('Release was corrupt');
  });
});

// ─── radarr_delete_from_blocklist ─────────────────────────────────────────────

describe('radarr_delete_from_blocklist', () => {
  it('calls delete and returns success', async () => {
    mswServer.use(http.delete(`${API}/blocklist/201`, () => HttpResponse.json({})));
    const result = await radarrModule.handlers['radarr_delete_from_blocklist']({ blocklistId: 201 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});

// ─── radarr_get_quality_profile ───────────────────────────────────────────────

describe('radarr_get_quality_profile', () => {
  it('returns trimmed profile details by ID', async () => {
    mswServer.use(http.get(`${API}/qualityprofile/4`, () => HttpResponse.json(qualityProfileFixtures[0])));
    const result = await radarrModule.handlers['radarr_get_quality_profile']({ profileId: 4 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(4);
    expect(data.name).toBe('Ultra-HD');
    expect(data.upgradeAllowed).toBe(true);
    expect(data.minFormatScore).toBe(0);
    expect(Array.isArray(data.customFormats)).toBe(true);
    expect(data.customFormats[0]).toHaveProperty('id');
    expect(data.customFormats[0]).toHaveProperty('score');
  });

  it('lists only allowed qualities', async () => {
    mswServer.use(http.get(`${API}/qualityprofile/4`, () => HttpResponse.json(qualityProfileFixtures[0])));
    const result = await radarrModule.handlers['radarr_get_quality_profile']({ profileId: 4 }, clients);
    const data = JSON.parse(result.content[0].text);
    // Ultra-HD has Remux-2160p allowed and HDTV-720p not allowed
    expect(data.qualities).toContain('Remux-2160p');
    expect(data.qualities).not.toContain('HDTV-720p');
  });
});

// ─── radarr_update_quality_profile ────────────────────────────────────────────

describe('radarr_update_quality_profile', () => {
  it('updates upgradeAllowed and minFormatScore', async () => {
    mswServer.use(
      http.get(`${API}/qualityprofile/4`, () => HttpResponse.json(qualityProfileFixtures[0])),
      http.put(`${API}/qualityprofile/4`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...qualityProfileFixtures[0], ...body });
      }),
    );
    const result = await radarrModule.handlers['radarr_update_quality_profile']({
      profileId: 4,
      upgradeAllowed: false,
      minFormatScore: -10001,
    }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.upgradeAllowed).toBe(false);
    expect(data.minFormatScore).toBe(-10001);
  });

  it('merges formatScores without overwriting unmodified formats', async () => {
    let putBody: Record<string, unknown> = {};
    mswServer.use(
      http.get(`${API}/qualityprofile/4`, () => HttpResponse.json(qualityProfileFixtures[0])),
      http.put(`${API}/qualityprofile/4`, async ({ request }) => {
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(putBody);
      }),
    );
    await radarrModule.handlers['radarr_update_quality_profile']({
      profileId: 4,
      formatScores: [{ formatId: 1, score: 2000 }],
    }, clients);
    const items = putBody['formatItems'] as Array<{ format: number; score: number }>;
    // Format 1 (HDR10) should be updated to 2000
    expect(items.find(f => f.format === 1)?.score).toBe(2000);
    // Format 2 (DV) should remain at 20
    expect(items.find(f => f.format === 2)?.score).toBe(20);
  });
});

// ─── radarr_list_custom_formats ───────────────────────────────────────────────

describe('radarr_list_custom_formats', () => {
  it('returns count and format list with specs', async () => {
    mswServer.use(http.get(`${API}/customformat`, () => HttpResponse.json(customFormatFixtures)));
    const result = await radarrModule.handlers['radarr_list_custom_formats']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(customFormatFixtures.length);
    expect(data.customFormats[0]).toHaveProperty('id');
    expect(data.customFormats[0]).toHaveProperty('name');
    expect(data.customFormats[0]).toHaveProperty('specifications');
    expect(Array.isArray(data.customFormats[0].specifications)).toBe(true);
  });

  it('uses implementationName when available', async () => {
    mswServer.use(http.get(`${API}/customformat`, () => HttpResponse.json(customFormatFixtures)));
    const result = await radarrModule.handlers['radarr_list_custom_formats']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.customFormats[0].specifications[0].implementation).toBe('Release Title');
  });
});

// ─── radarr_get_custom_format ─────────────────────────────────────────────────

describe('radarr_get_custom_format', () => {
  it('returns full format details by ID', async () => {
    const fmt = customFormatFixtures[0];
    mswServer.use(http.get(`${API}/customformat/${fmt.id}`, () => HttpResponse.json(fmt)));
    const result = await radarrModule.handlers['radarr_get_custom_format']({ formatId: fmt.id }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(fmt.id);
    expect(data.name).toBe(fmt.name);
    expect(Array.isArray(data.specifications)).toBe(true);
  });

  it('includes spec id and fields in response', async () => {
    const fmt = customFormatFixtures[0];
    mswServer.use(http.get(`${API}/customformat/${fmt.id}`, () => HttpResponse.json(fmt)));
    const result = await radarrModule.handlers['radarr_get_custom_format']({ formatId: fmt.id }, clients);
    const data = JSON.parse(result.content[0].text);
    const spec = data.specifications[0];
    expect(spec).toHaveProperty('id');
    expect(spec).toHaveProperty('fields');
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_get_custom_format']({ formatId: 1 }, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_create_custom_format ──────────────────────────────────────────────

describe('radarr_create_custom_format', () => {
  it('posts format and returns id and name', async () => {
    const created = { ...customFormatFixtures[0], id: 99, name: 'DV' };
    mswServer.use(http.post(`${API}/customformat`, () => HttpResponse.json(created, { status: 201 })));
    const result = await radarrModule.handlers['radarr_create_custom_format']({
      name: 'DV',
      specifications: customFormatFixtures[0].specifications,
    }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.id).toBe(99);
    expect(data.name).toBe('DV');
  });

  it('defaults includeWhenRenaming to false when not provided', async () => {
    let capturedBody: unknown;
    const created = { ...customFormatFixtures[0], id: 10, name: 'Test' };
    mswServer.use(http.post(`${API}/customformat`, async ({ request }) => {
      capturedBody = await request.json();
      return HttpResponse.json(created, { status: 201 });
    }));
    await radarrModule.handlers['radarr_create_custom_format']({ name: 'Test', specifications: [] }, clients);
    expect((capturedBody as { includeCustomFormatWhenRenaming: boolean }).includeCustomFormatWhenRenaming).toBe(false);
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_create_custom_format']({ name: 'x', specifications: [] }, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_update_custom_format ──────────────────────────────────────────────

describe('radarr_update_custom_format', () => {
  it('fetches existing format then PUTs with updated name', async () => {
    const fmt = customFormatFixtures[0];
    const updated = { ...fmt, name: 'HDR10+' };
    mswServer.use(
      http.get(`${API}/customformat/${fmt.id}`, () => HttpResponse.json(fmt)),
      http.put(`${API}/customformat/${fmt.id}`, () => HttpResponse.json(updated)),
    );
    const result = await radarrModule.handlers['radarr_update_custom_format']({ formatId: fmt.id, name: 'HDR10+' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.name).toBe('HDR10+');
  });

  it('replaces specifications when provided', async () => {
    const fmt = customFormatFixtures[0];
    let capturedBody: unknown;
    mswServer.use(
      http.get(`${API}/customformat/${fmt.id}`, () => HttpResponse.json(fmt)),
      http.put(`${API}/customformat/${fmt.id}`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...fmt, specifications: [] });
      }),
    );
    await radarrModule.handlers['radarr_update_custom_format']({ formatId: fmt.id, specifications: [] }, clients);
    expect((capturedBody as { specifications: unknown[] }).specifications).toEqual([]);
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_update_custom_format']({ formatId: 1 }, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_delete_custom_format ──────────────────────────────────────────────

describe('radarr_delete_custom_format', () => {
  it('deletes format and returns success', async () => {
    const fmt = customFormatFixtures[0];
    mswServer.use(http.delete(`${API}/customformat/${fmt.id}`, () => HttpResponse.json({})));
    const result = await radarrModule.handlers['radarr_delete_custom_format']({ formatId: fmt.id }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.message).toContain(`${fmt.id}`);
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_delete_custom_format']({ formatId: 1 }, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_get_system_tasks ──────────────────────────────────────────────────

describe('radarr_get_system_tasks', () => {
  it('returns count and task list', async () => {
    mswServer.use(http.get(`${API}/system/task`, () => HttpResponse.json(systemTaskFixtures)));
    const result = await radarrModule.handlers['radarr_get_system_tasks']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(systemTaskFixtures.length);
    expect(data.tasks[0]).toHaveProperty('name');
    expect(data.tasks[0]).toHaveProperty('taskName');
    expect(data.tasks[0]).toHaveProperty('nextExecution');
    expect(data.tasks[0]).toHaveProperty('isRunning');
  });

  it('converts interval minutes to hours', async () => {
    mswServer.use(http.get(`${API}/system/task`, () => HttpResponse.json(systemTaskFixtures)));
    const result = await radarrModule.handlers['radarr_get_system_tasks']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.tasks[0].intervalHours).toBe(systemTaskFixtures[0].interval / 60);
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_get_system_tasks']({}, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_get_logs ──────────────────────────────────────────────────────────

describe('radarr_get_logs', () => {
  it('returns paged log records', async () => {
    mswServer.use(http.get(`${API}/log`, () => HttpResponse.json(logPageFixture)));
    const result = await radarrModule.handlers['radarr_get_logs']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(logPageFixture.totalRecords);
    expect(Array.isArray(data.records)).toBe(true);
    expect(data.records[0]).toHaveProperty('time');
    expect(data.records[0]).toHaveProperty('level');
    expect(data.records[0]).toHaveProperty('message');
  });

  it('includes exception fields when present', async () => {
    mswServer.use(http.get(`${API}/log`, () => HttpResponse.json(logPageFixture)));
    const result = await radarrModule.handlers['radarr_get_logs']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const warnEntry = data.records.find((r: { level: string }) => r.level === 'warn');
    expect(warnEntry).toHaveProperty('exception');
    expect(warnEntry).toHaveProperty('exceptionType');
  });

  it('defaults to page 1 and pageSize 20', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(`${API}/log`, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json(logPageFixture);
    }));
    await radarrModule.handlers['radarr_get_logs']({}, clients);
    expect(capturedUrl).toContain('page=1');
    expect(capturedUrl).toContain('pageSize=20');
  });

  it('passes level filter when provided', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(`${API}/log`, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json(logPageFixture);
    }));
    await radarrModule.handlers['radarr_get_logs']({ level: 'error' }, clients);
    expect(capturedUrl).toContain('level=error');
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_get_logs']({}, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_trigger_backup ────────────────────────────────────────────────────

describe('radarr_trigger_backup', () => {
  it('posts Backup command and returns commandId', async () => {
    mswServer.use(http.post(`${API}/command`, () => HttpResponse.json({ id: 42 }, { status: 201 })));
    const result = await radarrModule.handlers['radarr_trigger_backup']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(42);
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_trigger_backup']({}, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_get_notifications ─────────────────────────────────────────────────

describe('radarr_get_notifications', () => {
  it('returns count and notification list', async () => {
    mswServer.use(http.get(`${API}/notification`, () => HttpResponse.json(notificationFixtures)));
    const result = await radarrModule.handlers['radarr_get_notifications']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(notificationFixtures.length);
    expect(data.notifications[0]).toHaveProperty('id');
    expect(data.notifications[0]).toHaveProperty('name');
    expect(data.notifications[0]).toHaveProperty('implementation');
    expect(data.notifications[0]).toHaveProperty('triggers');
  });

  it('returns implementationName as implementation', async () => {
    mswServer.use(http.get(`${API}/notification`, () => HttpResponse.json(notificationFixtures)));
    const result = await radarrModule.handlers['radarr_get_notifications']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.notifications[0].implementation).toBe('Slack');
  });

  it('includes trigger flags', async () => {
    mswServer.use(http.get(`${API}/notification`, () => HttpResponse.json(notificationFixtures)));
    const result = await radarrModule.handlers['radarr_get_notifications']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const triggers = data.notifications[0].triggers;
    expect(triggers).toHaveProperty('onGrab');
    expect(triggers).toHaveProperty('onDownload');
    expect(triggers).toHaveProperty('onHealthIssue');
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_get_notifications']({}, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_update_quality_definition ────────────────────────────────────────

describe('radarr_update_quality_definition', () => {
  it('fetches definitions then PUTs updated sizes', async () => {
    const def = qualityDefinitionFixtures[0];
    const updated = { ...def, minSize: 10, maxSize: 300 };
    mswServer.use(
      http.get(`${API}/qualitydefinition`, () => HttpResponse.json(qualityDefinitionFixtures)),
      http.put(`${API}/qualitydefinition/${def.id}`, () => HttpResponse.json(updated)),
    );
    const result = await radarrModule.handlers['radarr_update_quality_definition']({ definitionId: def.id, minSize: 10, maxSize: 300 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.minSize).toBe(10);
    expect(data.maxSize).toBe(300);
  });

  it('returns isError when definition id not found', async () => {
    mswServer.use(http.get(`${API}/qualitydefinition`, () => HttpResponse.json(qualityDefinitionFixtures)));
    const result = await radarrModule.handlers['radarr_update_quality_definition']({ definitionId: 999 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.isError).toBe(true);
  });

  it('only updates provided fields', async () => {
    const def = qualityDefinitionFixtures[0];
    let capturedBody: unknown;
    mswServer.use(
      http.get(`${API}/qualitydefinition`, () => HttpResponse.json(qualityDefinitionFixtures)),
      http.put(`${API}/qualitydefinition/${def.id}`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(def);
      }),
    );
    await radarrModule.handlers['radarr_update_quality_definition']({ definitionId: def.id, preferredSize: 200 }, clients);
    const body = capturedBody as typeof def;
    expect(body.preferredSize).toBe(200);
    expect(body.minSize).toBe(def.minSize);
    expect(body.maxSize).toBe(def.maxSize);
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_update_quality_definition']({ definitionId: 1 }, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_get_import_lists ──────────────────────────────────────────────────

describe('radarr_get_import_lists', () => {
  it('returns count and import list details', async () => {
    mswServer.use(http.get(`${API}/importlist`, () => HttpResponse.json(importListFixtures)));
    const result = await radarrModule.handlers['radarr_get_import_lists']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(importListFixtures.length);
    expect(data.importLists[0]).toHaveProperty('id');
    expect(data.importLists[0]).toHaveProperty('name');
    expect(data.importLists[0]).toHaveProperty('enabled');
    expect(data.importLists[0]).toHaveProperty('enableAuto');
  });

  it('returns implementationName as implementation', async () => {
    mswServer.use(http.get(`${API}/importlist`, () => HttpResponse.json(importListFixtures)));
    const result = await radarrModule.handlers['radarr_get_import_lists']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.importLists[0].implementation).toBe('Trakt Popular');
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_get_import_lists']({}, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_update_import_list ────────────────────────────────────────────────

describe('radarr_update_import_list', () => {
  it('fetches lists then PUTs with updated enabled flag', async () => {
    const list = importListFixtures[0];
    const updated = { ...list, enabled: false };
    mswServer.use(
      http.get(`${API}/importlist`, () => HttpResponse.json(importListFixtures)),
      http.put(`${API}/importlist/${list.id}`, () => HttpResponse.json(updated)),
    );
    const result = await radarrModule.handlers['radarr_update_import_list']({ listId: list.id, enabled: false }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.enabled).toBe(false);
  });

  it('returns isError when list id not found', async () => {
    mswServer.use(http.get(`${API}/importlist`, () => HttpResponse.json(importListFixtures)));
    const result = await radarrModule.handlers['radarr_update_import_list']({ listId: 999 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.isError).toBe(true);
  });

  it('only updates provided fields', async () => {
    const list = importListFixtures[1];
    let capturedBody: unknown;
    mswServer.use(
      http.get(`${API}/importlist`, () => HttpResponse.json(importListFixtures)),
      http.put(`${API}/importlist/${list.id}`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(list);
      }),
    );
    await radarrModule.handlers['radarr_update_import_list']({ listId: list.id, enableAuto: false }, clients);
    const body = capturedBody as typeof list;
    expect(body.enableAuto).toBe(false);
    expect(body.enabled).toBe(list.enabled);
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_update_import_list']({ listId: 1 }, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_create_tag ────────────────────────────────────────────────────────

describe('radarr_create_tag', () => {
  it('posts tag and returns id and label', async () => {
    const newTag = { id: 3, label: 'kids' };
    mswServer.use(http.post(`${API}/tag`, () => HttpResponse.json(newTag, { status: 201 })));
    const result = await radarrModule.handlers['radarr_create_tag']({ label: 'kids' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.id).toBe(3);
    expect(data.label).toBe('kids');
  });
});

// ─── radarr_delete_tag ────────────────────────────────────────────────────────

describe('radarr_delete_tag', () => {
  it('deletes tag and returns success', async () => {
    mswServer.use(http.delete(`${API}/tag/${tagFixtures[0].id}`, () => HttpResponse.json({})));
    const result = await radarrModule.handlers['radarr_delete_tag']({ tagId: tagFixtures[0].id }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});

// ─── radarr_get_import_exclusions ─────────────────────────────────────────────

describe('radarr_get_import_exclusions', () => {
  it('returns count and exclusion list', async () => {
    mswServer.use(http.get(`${API}/exclusions`, () => HttpResponse.json(radarrImportExclusionFixtures)));
    const result = await radarrModule.handlers['radarr_get_import_exclusions']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(radarrImportExclusionFixtures.length);
    expect(data.exclusions[0]).toHaveProperty('id');
    expect(data.exclusions[0]).toHaveProperty('title');
    expect(data.exclusions[0]).toHaveProperty('tmdbId');
  });
});

// ─── radarr_delete_import_exclusion ───────────────────────────────────────────

describe('radarr_delete_import_exclusion', () => {
  it('deletes exclusion and returns success', async () => {
    mswServer.use(http.delete(`${API}/exclusions/1`, () => HttpResponse.json({})));
    const result = await radarrModule.handlers['radarr_delete_import_exclusion']({ exclusionId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});

// ─── radarr_trigger_cutoff_unmet_search ───────────────────────────────────────

describe('radarr_trigger_cutoff_unmet_search', () => {
  it('posts CutoffUnmetMovieSearch command and returns commandId', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 999 });
    }));
    const result = await radarrModule.handlers['radarr_trigger_cutoff_unmet_search']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(999);
    expect(commandName).toBe('CutoffUnmetSearch');
  });
});

// ─── radarr_trigger_refresh_monitored_downloads ───────────────────────────────

describe('radarr_trigger_refresh_monitored_downloads', () => {
  it('posts RefreshMonitoredDownloads command and returns commandId', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 1001 });
    }));
    const result = await radarrModule.handlers['radarr_trigger_refresh_monitored_downloads']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(1001);
    expect(commandName).toBe('RefreshMonitoredDownloads');
  });
});

// ─── radarr_trigger_rss_sync ──────────────────────────────────────────────────

describe('radarr_trigger_rss_sync', () => {
  it('posts RssSync command and returns commandId', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 1002 });
    }));
    const result = await radarrModule.handlers['radarr_trigger_rss_sync']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(1002);
    expect(commandName).toBe('RssSync');
  });
});

// ─── radarr_search_releases ───────────────────────────────────────────────────

describe('radarr_search_releases', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/release`, () => HttpResponse.json(releaseFixtures)));
  });

  it('returns trimmed release list with count', async () => {
    const result = await radarrModule.handlers['radarr_search_releases']({ movieId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(releaseFixtures.length);
    expect(data.releases).toHaveLength(releaseFixtures.length);
  });

  it('includes guid and indexerId needed for grab', async () => {
    const result = await radarrModule.handlers['radarr_search_releases']({ movieId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    const first = data.releases[0];
    expect(first.guid).toBe(releaseFixtures[0].guid);
    expect(first.indexerId).toBe(releaseFixtures[0].indexerId);
  });

  it('formats size as human-readable', async () => {
    const result = await radarrModule.handlers['radarr_search_releases']({ movieId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.releases[0].size).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
  });

  it('includes rejection reasons', async () => {
    const result = await radarrModule.handlers['radarr_search_releases']({ movieId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    const rejected = data.releases.find((r: { rejected: boolean }) => r.rejected);
    expect(rejected.rejections).toContain('Quality cutoff not met');
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_search_releases']({ movieId: 1 }, {})).rejects.toThrow('Radarr is not configured');
  });
});

// ─── radarr_grab_release ──────────────────────────────────────────────────────

describe('radarr_grab_release', () => {
  it('posts to /release with guid and indexerId and returns grabbed title', async () => {
    let body: { guid?: string; indexerId?: number } = {};
    mswServer.use(http.post(`${API}/release`, async ({ request }) => {
      body = await request.json() as { guid: string; indexerId: number };
      return HttpResponse.json(releaseFixtures[0]);
    }));
    const result = await radarrModule.handlers['radarr_grab_release']({ guid: 'nzb-guid-001', indexerId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.title).toBe(releaseFixtures[0].title);
    expect(body.guid).toBe('nzb-guid-001');
    expect(body.indexerId).toBe(1);
  });

  it('throws when radarr is not configured', async () => {
    await expect(radarrModule.handlers['radarr_grab_release']({ guid: 'x', indexerId: 1 }, {})).rejects.toThrow('Radarr is not configured');
  });
});
