import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { sonarrModule } from '../../../src/services/sonarr.js';
import { SonarrClient } from '../../../src/clients/arr-client.js';
import { mswServer } from '../../setup.js';
import {
  seriesFixtures,
  episodeFixtures,
  episodeFileFixture,
  seriesHistoryFixture,
  seriesBlocklistFixture,
  seriesWantedMissingFixture,
  seriesSearchResultFixtures,
  sonarrImportExclusionFixtures,
  releaseFixtures,
} from '../../fixtures/sonarr/series.js';
import { qualityProfileFixtures, customFormatFixtures, tagFixtures, systemTaskFixtures, logPageFixture, notificationFixtures, qualityDefinitionFixtures, importListFixtures } from '../../fixtures/shared/config.js';

const BASE = 'http://sonarr.test';
const KEY = 'test-key';
const API = `${BASE}/api/v3`;

let sonarrClient: SonarrClient;
let clients: { sonarr: SonarrClient };

beforeEach(() => {
  sonarrClient = new SonarrClient({ url: BASE, apiKey: KEY });
  clients = { sonarr: sonarrClient };
});

// ─── sonarr_get_series ───────────────────────────────────────────────────────

describe('sonarr_get_series', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/series`, () => HttpResponse.json(seriesFixtures)));
  });

  it('returns paginated results', async () => {
    const result = await sonarrModule.handlers['sonarr_get_series']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(seriesFixtures.length);
    expect(data.items).toHaveLength(seriesFixtures.length);
  });

  it('returns summary fields only — no raw overview or episode lists', async () => {
    const result = await sonarrModule.handlers['sonarr_get_series']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const item = data.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('status');
    expect(item).toHaveProperty('network');
    expect(item).toHaveProperty('sizeOnDisk');
    // seasons is returned as a count (number), not the raw array
    expect(typeof item.seasons).toBe('number');
    // Raw fields that should be stripped
    expect(item).not.toHaveProperty('overview');
    expect(item).not.toHaveProperty('imdbId');
    expect(item).not.toHaveProperty('tvdbId');
    expect(item).not.toHaveProperty('statistics');
  });

  it('formats sizeOnDisk as human-readable string', async () => {
    const result = await sonarrModule.handlers['sonarr_get_series']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0].sizeOnDisk).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
  });

  it('includes episodes summary like "62/62"', async () => {
    const result = await sonarrModule.handlers['sonarr_get_series']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0].episodes).toMatch(/^\d+\/\d+$/);
  });

  it('filters by search term (case-insensitive)', async () => {
    const result = await sonarrModule.handlers['sonarr_get_series']({ search: 'breaking' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items.every((s: { title: string }) => s.title.toLowerCase().includes('breaking'))).toBe(true);
  });

  it('paginates with limit and offset', async () => {
    const result = await sonarrModule.handlers['sonarr_get_series']({ limit: 1, offset: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.returned).toBe(1);
    expect(data.items[0].title).toBe(seriesFixtures[1].title);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_get_series']({}, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_search ───────────────────────────────────────────────────────────

describe('sonarr_search', () => {
  it('returns search results with tvdbId and truncated overview', async () => {
    mswServer.use(http.get(`${API}/series/lookup`, () => HttpResponse.json(seriesSearchResultFixtures)));
    const result = await sonarrModule.handlers['sonarr_search']({ term: 'The Wire' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(seriesSearchResultFixtures.length);
    expect(data.results[0]).toHaveProperty('tvdbId');
    const overview = data.results[0].overview as string | undefined;
    if (overview) expect(overview.length).toBeLessThanOrEqual(201);
  });
});

// ─── sonarr_get_episodes ──────────────────────────────────────────────────────

describe('sonarr_get_episodes', () => {
  it('returns episode summary fields', async () => {
    mswServer.use(http.get(`${API}/episode`, () => HttpResponse.json(episodeFixtures)));
    const result = await sonarrModule.handlers['sonarr_get_episodes']({ seriesId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(episodeFixtures.length);
    const ep = data.episodes[0];
    expect(ep).toHaveProperty('id');
    expect(ep).toHaveProperty('seasonNumber');
    expect(ep).toHaveProperty('episodeNumber');
    expect(ep).toHaveProperty('hasFile');
    // Raw nested objects should not be present
    expect(ep).not.toHaveProperty('episodeFile');
    expect(ep).not.toHaveProperty('overview');
  });
});

// ─── sonarr_add_series ────────────────────────────────────────────────────────

describe('sonarr_add_series', () => {
  it('returns success with series id and path', async () => {
    const added = { id: 99, title: 'The Wire', year: 2002, path: '/tv/The Wire', monitored: true };
    mswServer.use(http.post(`${API}/series`, () => HttpResponse.json(added, { status: 201 })));
    const result = await sonarrModule.handlers['sonarr_add_series']({
      tvdbId: 79126, title: 'The Wire', qualityProfileId: 4, rootFolderPath: '/tv',
    }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.id).toBe(99);
    expect(data.path).toBe('/tv/The Wire');
  });
});

// ─── sonarr_delete_series ─────────────────────────────────────────────────────

describe('sonarr_delete_series', () => {
  it('returns success message with series title', async () => {
    mswServer.use(
      http.get(`${API}/series/1`, () => HttpResponse.json(seriesFixtures[0])),
      http.delete(`${API}/series/1`, () => HttpResponse.json({})),
    );
    const result = await sonarrModule.handlers['sonarr_delete_series']({ seriesId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.deletedFiles).toBe(false);
  });
});

// ─── sonarr_get_history ───────────────────────────────────────────────────────

describe('sonarr_get_history', () => {
  it('handles paged history response (no seriesId)', async () => {
    const paged = { records: seriesHistoryFixture, totalRecords: 1, page: 1, pageSize: 20 };
    mswServer.use(http.get(`${API}/history`, () => HttpResponse.json(paged)));
    const result = await sonarrModule.handlers['sonarr_get_history']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(1);
    expect(data.records[0].eventType).toBe('downloadFolderImported');
  });

  it('handles series-specific history via /history/series endpoint', async () => {
    const paged = { records: seriesHistoryFixture, totalRecords: 1, page: 1, pageSize: 20 };
    mswServer.use(http.get(`${API}/history/series`, () => HttpResponse.json(paged)));
    const result = await sonarrModule.handlers['sonarr_get_history']({ seriesId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.seriesId).toBe(1);
    expect(data.records).toHaveLength(seriesHistoryFixture.length);
  });
});

// ─── sonarr_remove_from_queue ─────────────────────────────────────────────────

describe('sonarr_remove_from_queue', () => {
  it('uses single DELETE for one id', async () => {
    let calledId = '';
    mswServer.use(http.delete(`${API}/queue/:id`, ({ params }) => {
      calledId = params['id'] as string;
      return HttpResponse.json({});
    }));
    const result = await sonarrModule.handlers['sonarr_remove_from_queue']({ ids: [55] }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(calledId).toBe('55');
  });

  it('uses bulk DELETE for multiple ids', async () => {
    let bulkCalled = false;
    mswServer.use(http.delete(`${API}/queue/bulk`, () => {
      bulkCalled = true;
      return HttpResponse.json({});
    }));
    await sonarrModule.handlers['sonarr_remove_from_queue']({ ids: [1, 2] }, clients);
    expect(bulkCalled).toBe(true);
  });
});

// ─── sonarr_get_wanted_missing ────────────────────────────────────────────────

describe('sonarr_get_wanted_missing', () => {
  it('returns wanted missing with missingEpisodes count', async () => {
    mswServer.use(http.get(`${API}/wanted/missing`, () => HttpResponse.json(seriesWantedMissingFixture)));
    const result = await sonarrModule.handlers['sonarr_get_wanted_missing']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(seriesWantedMissingFixture.totalRecords);
    expect(data.series[0]).toHaveProperty('missingEpisodes');
    // Raw overview should not leak through
    expect(data.series[0]).not.toHaveProperty('overview');
  });
});

// ─── sonarr_get_episode_files ─────────────────────────────────────────────────

describe('sonarr_get_episode_files', () => {
  it('returns file details with total size and per-file info', async () => {
    mswServer.use(http.get(`${API}/episodefile`, () => HttpResponse.json([episodeFileFixture])));
    const result = await sonarrModule.handlers['sonarr_get_episode_files']({ seriesId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(1);
    expect(data.totalSize).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
    expect(data.files[0].size).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
    expect(data.files[0].quality).toBe('Bluray-1080p');
  });
});

// ─── sonarr_get_blocklist ─────────────────────────────────────────────────────

describe('sonarr_get_blocklist', () => {
  it('returns blocklist entries', async () => {
    const paged = { records: seriesBlocklistFixture, totalRecords: 1, page: 1, pageSize: 20 };
    // SonarrClient.getBlocklist calls /blocklist (not /blocklist/movie like Radarr)
    mswServer.use(http.get(`${API}/blocklist`, () => HttpResponse.json(paged)));
    const result = await sonarrModule.handlers['sonarr_get_blocklist']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(1);
    expect(data.entries[0].sourceTitle).toBe(seriesBlocklistFixture[0].sourceTitle);
  });
});

// ─── sonarr_delete_from_blocklist ─────────────────────────────────────────────

describe('sonarr_delete_from_blocklist', () => {
  it('calls delete and returns success', async () => {
    mswServer.use(http.delete(`${API}/blocklist/301`, () => HttpResponse.json({})));
    const result = await sonarrModule.handlers['sonarr_delete_from_blocklist']({ blocklistId: 301 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});

// ─── sonarr_monitor_episodes ──────────────────────────────────────────────────

describe('sonarr_monitor_episodes', () => {
  it('calls the episode endpoint and returns success', async () => {
    mswServer.use(http.put(`${API}/episode/monitor`, () => HttpResponse.json({})));
    const result = await sonarrModule.handlers['sonarr_monitor_episodes']({
      episodeIds: [1001, 1002], monitored: true,
    }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});

// ─── sonarr_get_quality_profile ───────────────────────────────────────────────

describe('sonarr_get_quality_profile', () => {
  it('returns trimmed profile details by ID', async () => {
    mswServer.use(http.get(`${API}/qualityprofile/4`, () => HttpResponse.json(qualityProfileFixtures[0])));
    const result = await sonarrModule.handlers['sonarr_get_quality_profile']({ profileId: 4 }, clients);
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
    const result = await sonarrModule.handlers['sonarr_get_quality_profile']({ profileId: 4 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.qualities).toContain('Remux-2160p');
    expect(data.qualities).not.toContain('HDTV-720p');
  });
});

// ─── sonarr_update_quality_profile ────────────────────────────────────────────

describe('sonarr_update_quality_profile', () => {
  it('updates upgradeAllowed and minFormatScore', async () => {
    mswServer.use(
      http.get(`${API}/qualityprofile/4`, () => HttpResponse.json(qualityProfileFixtures[0])),
      http.put(`${API}/qualityprofile/4`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...qualityProfileFixtures[0], ...body });
      }),
    );
    const result = await sonarrModule.handlers['sonarr_update_quality_profile']({
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
    await sonarrModule.handlers['sonarr_update_quality_profile']({
      profileId: 4,
      formatScores: [{ formatId: 1, score: 2000 }],
    }, clients);
    const items = putBody['formatItems'] as Array<{ format: number; score: number }>;
    expect(items.find(f => f.format === 1)?.score).toBe(2000);
    expect(items.find(f => f.format === 2)?.score).toBe(20);
  });
});

// ─── sonarr_list_custom_formats ───────────────────────────────────────────────

describe('sonarr_list_custom_formats', () => {
  it('returns count and format list with specs', async () => {
    mswServer.use(http.get(`${API}/customformat`, () => HttpResponse.json(customFormatFixtures)));
    const result = await sonarrModule.handlers['sonarr_list_custom_formats']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(customFormatFixtures.length);
    expect(data.customFormats[0]).toHaveProperty('id');
    expect(data.customFormats[0]).toHaveProperty('name');
    expect(data.customFormats[0]).toHaveProperty('specifications');
    expect(Array.isArray(data.customFormats[0].specifications)).toBe(true);
  });

  it('uses implementationName when available', async () => {
    mswServer.use(http.get(`${API}/customformat`, () => HttpResponse.json(customFormatFixtures)));
    const result = await sonarrModule.handlers['sonarr_list_custom_formats']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.customFormats[0].specifications[0].implementation).toBe('Release Title');
  });
});

// ─── sonarr_get_custom_format ─────────────────────────────────────────────────

describe('sonarr_get_custom_format', () => {
  it('returns full format details by ID', async () => {
    const fmt = customFormatFixtures[0];
    mswServer.use(http.get(`${API}/customformat/${fmt.id}`, () => HttpResponse.json(fmt)));
    const result = await sonarrModule.handlers['sonarr_get_custom_format']({ formatId: fmt.id }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(fmt.id);
    expect(data.name).toBe(fmt.name);
    expect(Array.isArray(data.specifications)).toBe(true);
  });

  it('includes spec id and fields in response', async () => {
    const fmt = customFormatFixtures[0];
    mswServer.use(http.get(`${API}/customformat/${fmt.id}`, () => HttpResponse.json(fmt)));
    const result = await sonarrModule.handlers['sonarr_get_custom_format']({ formatId: fmt.id }, clients);
    const data = JSON.parse(result.content[0].text);
    const spec = data.specifications[0];
    expect(spec).toHaveProperty('id');
    expect(spec).toHaveProperty('fields');
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_get_custom_format']({ formatId: 1 }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_create_custom_format ──────────────────────────────────────────────

describe('sonarr_create_custom_format', () => {
  it('posts format and returns id and name', async () => {
    const created = { ...customFormatFixtures[0], id: 99, name: 'DV' };
    mswServer.use(http.post(`${API}/customformat`, () => HttpResponse.json(created, { status: 201 })));
    const result = await sonarrModule.handlers['sonarr_create_custom_format']({
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
    await sonarrModule.handlers['sonarr_create_custom_format']({ name: 'Test', specifications: [] }, clients);
    expect((capturedBody as { includeCustomFormatWhenRenaming: boolean }).includeCustomFormatWhenRenaming).toBe(false);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_create_custom_format']({ name: 'x', specifications: [] }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_update_custom_format ──────────────────────────────────────────────

describe('sonarr_update_custom_format', () => {
  it('fetches existing format then PUTs with updated name', async () => {
    const fmt = customFormatFixtures[0];
    const updated = { ...fmt, name: 'HDR10+' };
    mswServer.use(
      http.get(`${API}/customformat/${fmt.id}`, () => HttpResponse.json(fmt)),
      http.put(`${API}/customformat/${fmt.id}`, () => HttpResponse.json(updated)),
    );
    const result = await sonarrModule.handlers['sonarr_update_custom_format']({ formatId: fmt.id, name: 'HDR10+' }, clients);
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
    await sonarrModule.handlers['sonarr_update_custom_format']({ formatId: fmt.id, specifications: [] }, clients);
    expect((capturedBody as { specifications: unknown[] }).specifications).toEqual([]);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_update_custom_format']({ formatId: 1 }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_delete_custom_format ──────────────────────────────────────────────

describe('sonarr_delete_custom_format', () => {
  it('deletes format and returns success', async () => {
    const fmt = customFormatFixtures[0];
    mswServer.use(http.delete(`${API}/customformat/${fmt.id}`, () => HttpResponse.json({})));
    const result = await sonarrModule.handlers['sonarr_delete_custom_format']({ formatId: fmt.id }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.message).toContain(`${fmt.id}`);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_delete_custom_format']({ formatId: 1 }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_get_system_tasks ──────────────────────────────────────────────────

describe('sonarr_get_system_tasks', () => {
  it('returns count and task list', async () => {
    mswServer.use(http.get(`${API}/system/task`, () => HttpResponse.json(systemTaskFixtures)));
    const result = await sonarrModule.handlers['sonarr_get_system_tasks']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(systemTaskFixtures.length);
    expect(data.tasks[0]).toHaveProperty('name');
    expect(data.tasks[0]).toHaveProperty('taskName');
    expect(data.tasks[0]).toHaveProperty('nextExecution');
    expect(data.tasks[0]).toHaveProperty('isRunning');
  });

  it('converts interval minutes to hours', async () => {
    mswServer.use(http.get(`${API}/system/task`, () => HttpResponse.json(systemTaskFixtures)));
    const result = await sonarrModule.handlers['sonarr_get_system_tasks']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.tasks[0].intervalHours).toBe(systemTaskFixtures[0].interval / 60);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_get_system_tasks']({}, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_get_logs ──────────────────────────────────────────────────────────

describe('sonarr_get_logs', () => {
  it('returns paged log records', async () => {
    mswServer.use(http.get(`${API}/log`, () => HttpResponse.json(logPageFixture)));
    const result = await sonarrModule.handlers['sonarr_get_logs']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(logPageFixture.totalRecords);
    expect(Array.isArray(data.records)).toBe(true);
    expect(data.records[0]).toHaveProperty('time');
    expect(data.records[0]).toHaveProperty('level');
    expect(data.records[0]).toHaveProperty('message');
  });

  it('includes exception fields when present', async () => {
    mswServer.use(http.get(`${API}/log`, () => HttpResponse.json(logPageFixture)));
    const result = await sonarrModule.handlers['sonarr_get_logs']({}, clients);
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
    await sonarrModule.handlers['sonarr_get_logs']({}, clients);
    expect(capturedUrl).toContain('page=1');
    expect(capturedUrl).toContain('pageSize=20');
  });

  it('passes level filter when provided', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(`${API}/log`, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json(logPageFixture);
    }));
    await sonarrModule.handlers['sonarr_get_logs']({ level: 'error' }, clients);
    expect(capturedUrl).toContain('level=error');
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_get_logs']({}, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_trigger_backup ────────────────────────────────────────────────────

describe('sonarr_trigger_backup', () => {
  it('posts Backup command and returns commandId', async () => {
    mswServer.use(http.post(`${API}/command`, () => HttpResponse.json({ id: 42 }, { status: 201 })));
    const result = await sonarrModule.handlers['sonarr_trigger_backup']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(42);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_trigger_backup']({}, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_get_notifications ─────────────────────────────────────────────────

describe('sonarr_get_notifications', () => {
  it('returns count and notification list', async () => {
    mswServer.use(http.get(`${API}/notification`, () => HttpResponse.json(notificationFixtures)));
    const result = await sonarrModule.handlers['sonarr_get_notifications']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(notificationFixtures.length);
    expect(data.notifications[0]).toHaveProperty('id');
    expect(data.notifications[0]).toHaveProperty('name');
    expect(data.notifications[0]).toHaveProperty('implementation');
    expect(data.notifications[0]).toHaveProperty('triggers');
  });

  it('returns implementationName as implementation', async () => {
    mswServer.use(http.get(`${API}/notification`, () => HttpResponse.json(notificationFixtures)));
    const result = await sonarrModule.handlers['sonarr_get_notifications']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.notifications[0].implementation).toBe('Slack');
  });

  it('includes trigger flags', async () => {
    mswServer.use(http.get(`${API}/notification`, () => HttpResponse.json(notificationFixtures)));
    const result = await sonarrModule.handlers['sonarr_get_notifications']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const triggers = data.notifications[0].triggers;
    expect(triggers).toHaveProperty('onGrab');
    expect(triggers).toHaveProperty('onDownload');
    expect(triggers).toHaveProperty('onHealthIssue');
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_get_notifications']({}, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_update_quality_definition ────────────────────────────────────────

describe('sonarr_update_quality_definition', () => {
  it('fetches definitions then PUTs updated sizes', async () => {
    const def = qualityDefinitionFixtures[0];
    const updated = { ...def, minSize: 10, maxSize: 300 };
    mswServer.use(
      http.get(`${API}/qualitydefinition`, () => HttpResponse.json(qualityDefinitionFixtures)),
      http.put(`${API}/qualitydefinition/${def.id}`, () => HttpResponse.json(updated)),
    );
    const result = await sonarrModule.handlers['sonarr_update_quality_definition']({ definitionId: def.id, minSize: 10, maxSize: 300 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.minSize).toBe(10);
    expect(data.maxSize).toBe(300);
  });

  it('returns isError when definition id not found', async () => {
    mswServer.use(http.get(`${API}/qualitydefinition`, () => HttpResponse.json(qualityDefinitionFixtures)));
    const result = await sonarrModule.handlers['sonarr_update_quality_definition']({ definitionId: 999 }, clients);
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
    await sonarrModule.handlers['sonarr_update_quality_definition']({ definitionId: def.id, preferredSize: 200 }, clients);
    const body = capturedBody as typeof def;
    expect(body.preferredSize).toBe(200);
    expect(body.minSize).toBe(def.minSize);
    expect(body.maxSize).toBe(def.maxSize);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_update_quality_definition']({ definitionId: 1 }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_get_import_lists ──────────────────────────────────────────────────

describe('sonarr_get_import_lists', () => {
  it('returns count and import list details', async () => {
    mswServer.use(http.get(`${API}/importlist`, () => HttpResponse.json(importListFixtures)));
    const result = await sonarrModule.handlers['sonarr_get_import_lists']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(importListFixtures.length);
    expect(data.importLists[0]).toHaveProperty('id');
    expect(data.importLists[0]).toHaveProperty('name');
    expect(data.importLists[0]).toHaveProperty('enabled');
    expect(data.importLists[0]).toHaveProperty('enableAuto');
  });

  it('returns implementationName as implementation', async () => {
    mswServer.use(http.get(`${API}/importlist`, () => HttpResponse.json(importListFixtures)));
    const result = await sonarrModule.handlers['sonarr_get_import_lists']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.importLists[0].implementation).toBe('Trakt Popular');
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_get_import_lists']({}, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_update_import_list ────────────────────────────────────────────────

describe('sonarr_update_import_list', () => {
  it('fetches lists then PUTs with updated enabled flag', async () => {
    const list = importListFixtures[0];
    const updated = { ...list, enabled: false };
    mswServer.use(
      http.get(`${API}/importlist`, () => HttpResponse.json(importListFixtures)),
      http.put(`${API}/importlist/${list.id}`, () => HttpResponse.json(updated)),
    );
    const result = await sonarrModule.handlers['sonarr_update_import_list']({ listId: list.id, enabled: false }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.enabled).toBe(false);
  });

  it('returns isError when list id not found', async () => {
    mswServer.use(http.get(`${API}/importlist`, () => HttpResponse.json(importListFixtures)));
    const result = await sonarrModule.handlers['sonarr_update_import_list']({ listId: 999 }, clients);
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
    await sonarrModule.handlers['sonarr_update_import_list']({ listId: list.id, enableAuto: false }, clients);
    const body = capturedBody as typeof list;
    expect(body.enableAuto).toBe(false);
    expect(body.enabled).toBe(list.enabled);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_update_import_list']({ listId: 1 }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_create_tag ────────────────────────────────────────────────────────

describe('sonarr_create_tag', () => {
  it('posts tag and returns id and label', async () => {
    const newTag = { id: 5, label: 'anime' };
    mswServer.use(http.post(`${API}/tag`, () => HttpResponse.json(newTag, { status: 201 })));
    const result = await sonarrModule.handlers['sonarr_create_tag']({ label: 'anime' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.id).toBe(5);
    expect(data.label).toBe('anime');
  });
});

// ─── sonarr_delete_tag ────────────────────────────────────────────────────────

describe('sonarr_delete_tag', () => {
  it('deletes tag and returns success', async () => {
    mswServer.use(http.delete(`${API}/tag/${tagFixtures[0].id}`, () => HttpResponse.json({})));
    const result = await sonarrModule.handlers['sonarr_delete_tag']({ tagId: tagFixtures[0].id }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});

// ─── sonarr_get_import_exclusions ─────────────────────────────────────────────

describe('sonarr_get_import_exclusions', () => {
  it('returns count and exclusion list', async () => {
    mswServer.use(http.get(`${API}/importlistexclusion`, () => HttpResponse.json(sonarrImportExclusionFixtures)));
    const result = await sonarrModule.handlers['sonarr_get_import_exclusions']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(sonarrImportExclusionFixtures.length);
    expect(data.exclusions[0]).toHaveProperty('id');
    expect(data.exclusions[0]).toHaveProperty('title');
    expect(data.exclusions[0]).toHaveProperty('tvdbId');
  });
});

// ─── sonarr_delete_import_exclusion ───────────────────────────────────────────

describe('sonarr_delete_import_exclusion', () => {
  it('deletes exclusion and returns success', async () => {
    mswServer.use(http.delete(`${API}/importlistexclusion/1`, () => HttpResponse.json({})));
    const result = await sonarrModule.handlers['sonarr_delete_import_exclusion']({ exclusionId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});

// ─── sonarr_trigger_cutoff_unmet_search ───────────────────────────────────────

describe('sonarr_trigger_cutoff_unmet_search', () => {
  it('posts CutoffUnmetEpisodeSearch command and returns commandId', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 888 });
    }));
    const result = await sonarrModule.handlers['sonarr_trigger_cutoff_unmet_search']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(888);
    expect(commandName).toBe('CutoffUnmetEpisodeSearch');
  });
});

// ─── sonarr_trigger_refresh_monitored_downloads ───────────────────────────────

describe('sonarr_trigger_refresh_monitored_downloads', () => {
  it('posts RefreshMonitoredDownloads command and returns commandId', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 889 });
    }));
    const result = await sonarrModule.handlers['sonarr_trigger_refresh_monitored_downloads']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(889);
    expect(commandName).toBe('RefreshMonitoredDownloads');
  });
});

// ─── sonarr_trigger_rss_sync ──────────────────────────────────────────────────

describe('sonarr_trigger_rss_sync', () => {
  it('posts RssSync command and returns commandId', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 890 });
    }));
    const result = await sonarrModule.handlers['sonarr_trigger_rss_sync']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(890);
    expect(commandName).toBe('RssSync');
  });
});

// ─── sonarr_search_releases ───────────────────────────────────────────────────

describe('sonarr_search_releases', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/release`, () => HttpResponse.json(releaseFixtures)));
  });

  it('returns trimmed release list with count', async () => {
    const result = await sonarrModule.handlers['sonarr_search_releases']({ episodeId: 1001 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(releaseFixtures.length);
    expect(data.releases).toHaveLength(releaseFixtures.length);
  });

  it('includes guid and indexerId needed for grab', async () => {
    const result = await sonarrModule.handlers['sonarr_search_releases']({ episodeId: 1001 }, clients);
    const data = JSON.parse(result.content[0].text);
    const first = data.releases[0];
    expect(first.guid).toBe(releaseFixtures[0].guid);
    expect(first.indexerId).toBe(releaseFixtures[0].indexerId);
  });

  it('formats size as human-readable', async () => {
    const result = await sonarrModule.handlers['sonarr_search_releases']({ episodeId: 1001 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.releases[0].size).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
  });

  it('includes rejection reasons', async () => {
    const result = await sonarrModule.handlers['sonarr_search_releases']({ episodeId: 1001 }, clients);
    const data = JSON.parse(result.content[0].text);
    const rejected = data.releases.find((r: { rejected: boolean }) => r.rejected);
    expect(rejected.rejections).toContain('Quality cutoff not met');
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_search_releases']({ episodeId: 1001 }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_grab_release ──────────────────────────────────────────────────────

describe('sonarr_grab_release', () => {
  it('posts to /release with guid and indexerId and returns grabbed title', async () => {
    let body: { guid?: string; indexerId?: number } = {};
    mswServer.use(http.post(`${API}/release`, async ({ request }) => {
      body = await request.json() as { guid: string; indexerId: number };
      return HttpResponse.json(releaseFixtures[0]);
    }));
    const result = await sonarrModule.handlers['sonarr_grab_release']({ guid: 'nzb-guid-s01e01', indexerId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.title).toBe(releaseFixtures[0].title);
    expect(body.guid).toBe('nzb-guid-s01e01');
    expect(body.indexerId).toBe(1);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_grab_release']({ guid: 'x', indexerId: 1 }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_get_queue — diagnostic fields ────────────────────────────────────

describe('sonarr_get_queue diagnostic fields', () => {
  const queueWithDiagnostics = {
    totalRecords: 1,
    records: [
      {
        title: 'Breaking Bad S03E01',
        status: 'completed',
        trackedDownloadStatus: 'warning',
        trackedDownloadState: 'importBlocked',
        statusMessages: [{ title: 'Already Imported', messages: ['File already exists in library'] }],
        size: 1000,
        sizeleft: 0,
        timeleft: null,
        downloadClient: 'SABnzbd',
      },
    ],
  };

  beforeEach(() => {
    mswServer.use(http.get(`${API}/queue`, () => HttpResponse.json(queueWithDiagnostics)));
  });

  it('includes trackedDownloadStatus in queue items', async () => {
    const result = await sonarrModule.handlers['sonarr_get_queue']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0].trackedDownloadStatus).toBe('warning');
  });

  it('includes trackedDownloadState in queue items', async () => {
    const result = await sonarrModule.handlers['sonarr_get_queue']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0].trackedDownloadState).toBe('importBlocked');
  });

  it('includes statusMessages in queue items', async () => {
    const result = await sonarrModule.handlers['sonarr_get_queue']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0].statusMessages).toHaveLength(1);
    expect(data.items[0].statusMessages[0].title).toBe('Already Imported');
  });
});

// ─── sonarr_get_command_status ───────────────────────────────────────────────

describe('sonarr_get_command_status', () => {
  const commandResponse = { id: 77, name: 'RefreshSeries', status: 'completed', message: 'Completed', started: '2024-03-01T00:00:00Z', ended: '2024-03-01T00:01:00Z' };

  it('returns command status fields', async () => {
    mswServer.use(http.get(`${API}/command/77`, () => HttpResponse.json(commandResponse)));
    const result = await sonarrModule.handlers['sonarr_get_command_status']({ commandId: 77 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(77);
    expect(data.name).toBe('RefreshSeries');
    expect(data.status).toBe('completed');
    expect(data.started).toBe('2024-03-01T00:00:00Z');
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_get_command_status']({ commandId: 1 }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_refresh_series (optional ID) ─────────────────────────────────────

describe('sonarr_refresh_series (optional seriesId)', () => {
  it('refreshes specific series when seriesId provided', async () => {
    mswServer.use(
      http.get(`${API}/series/1`, () => HttpResponse.json(seriesFixtures[0])),
      http.post(`${API}/command`, () => HttpResponse.json({ id: 55 })),
    );
    const result = await sonarrModule.handlers['sonarr_refresh_series']({ seriesId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.series).toBeDefined();
    expect(data.commandId).toBe(55);
  });

  it('refreshes all series when seriesId is omitted', async () => {
    let commandBody: Record<string, unknown> = {};
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      commandBody = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 56 });
    }));
    const result = await sonarrModule.handlers['sonarr_refresh_series']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(56);
    expect(commandBody['name']).toBe('RefreshSeries');
    expect(commandBody).not.toHaveProperty('seriesId');
  });
});

// ─── sonarr_trigger_rescan_series ────────────────────────────────────────────

describe('sonarr_trigger_rescan_series', () => {
  it('posts RescanSeries command and returns commandId', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 200 });
    }));
    const result = await sonarrModule.handlers['sonarr_trigger_rescan_series']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(200);
    expect(commandName).toBe('RescanSeries');
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_trigger_rescan_series']({}, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_trigger_rename_series ────────────────────────────────────────────

describe('sonarr_trigger_rename_series', () => {
  it('posts RenameSeries for all series when no IDs provided', async () => {
    let commandBody: Record<string, unknown> = {};
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      commandBody = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 201 });
    }));
    const result = await sonarrModule.handlers['sonarr_trigger_rename_series']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(201);
    expect(commandBody['name']).toBe('RenameSeries');
    expect(commandBody['seriesIds']).toEqual([]);
  });

  it('posts RenameSeries with specific IDs', async () => {
    let commandBody: Record<string, unknown> = {};
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      commandBody = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 202 });
    }));
    const result = await sonarrModule.handlers['sonarr_trigger_rename_series']({ seriesIds: [1, 2] }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.commandId).toBe(202);
    expect(commandBody['seriesIds']).toEqual([1, 2]);
  });
});

// ─── sonarr_trigger_downloaded_scan ─────────────────────────────────────────

describe('sonarr_trigger_downloaded_scan', () => {
  it('posts DownloadedEpisodesScan command', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 203 });
    }));
    const result = await sonarrModule.handlers['sonarr_trigger_downloaded_scan']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(203);
    expect(commandName).toBe('DownloadedEpisodesScan');
  });
});

// ─── sonarr_bulk_update_series ───────────────────────────────────────────────

describe('sonarr_bulk_update_series', () => {
  it('sends PUT to /series/editor with seriesIds and changes', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.put(`${API}/series/editor`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return new HttpResponse(null, { status: 204 });
    }));
    const result = await sonarrModule.handlers['sonarr_bulk_update_series']({ seriesIds: [1, 2, 3], monitored: false }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.seriesIds).toEqual([1, 2, 3]);
    expect(body['seriesIds']).toEqual([1, 2, 3]);
    expect(body['monitored']).toBe(false);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_bulk_update_series']({ seriesIds: [1] }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_bulk_delete_series ───────────────────────────────────────────────

describe('sonarr_bulk_delete_series', () => {
  it('sends DELETE to /series/editor with seriesIds', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.delete(`${API}/series/editor`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return new HttpResponse(null, { status: 204 });
    }));
    const result = await sonarrModule.handlers['sonarr_bulk_delete_series']({ seriesIds: [5, 6] }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(body['seriesIds']).toEqual([5, 6]);
    expect(body['deleteFiles']).toBe(false);
  });

  it('passes deleteFiles: true when requested', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(http.delete(`${API}/series/editor`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return new HttpResponse(null, { status: 204 });
    }));
    await sonarrModule.handlers['sonarr_bulk_delete_series']({ seriesIds: [7], deleteFiles: true }, clients);
    expect(body['deleteFiles']).toBe(true);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_bulk_delete_series']({ seriesIds: [1] }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_get_manual_import ─────────────────────────────────────────────────

describe('sonarr_get_manual_import', () => {
  const manualImportItems = [
    {
      id: 1,
      path: '/downloads/show.s01e01.mkv',
      relativePath: 'show.s01e01.mkv',
      folderName: 'downloads',
      name: 'show.s01e01',
      size: 1_000_000_000,
      series: { id: 1, title: 'Breaking Bad' },
      seasonNumber: 1,
      episodes: [{ id: 101, title: 'Pilot' }],
      quality: { quality: { name: 'Bluray-1080p' }, revision: { version: 1 } },
      rejections: [],
    },
    {
      id: 2,
      path: '/downloads/unknown.mkv',
      relativePath: 'unknown.mkv',
      folderName: 'downloads',
      name: 'unknown',
      size: 500_000_000,
      quality: { quality: { name: 'Unknown' }, revision: { version: 1 } },
      rejections: [{ reason: 'No match found', type: 'permanent' }],
    },
  ];

  it('returns items with quality and rejection fields', async () => {
    mswServer.use(http.get(`${API}/manualimport`, () => HttpResponse.json(manualImportItems)));
    const result = await sonarrModule.handlers['sonarr_get_manual_import']({ folder: '/downloads' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(2);
    expect(data.items[0].quality).toBe('Bluray-1080p');
    expect(data.items[0].series).toEqual({ id: 1, title: 'Breaking Bad' });
    expect(data.items[0].rejections).toEqual([]);
    expect(data.items[1].rejections).toHaveLength(1);
  });

  it('passes folder and filterExistingFiles params', async () => {
    let params = new URLSearchParams();
    mswServer.use(http.get(`${API}/manualimport`, ({ request }) => {
      params = new URL(request.url).searchParams;
      return HttpResponse.json([]);
    }));
    await sonarrModule.handlers['sonarr_get_manual_import']({ folder: '/nas/tv', filterExistingFiles: false }, clients);
    expect(params.get('folder')).toBe('/nas/tv');
    expect(params.get('filterExistingFiles')).toBe('false');
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_get_manual_import']({ folder: '/x' }, {})).rejects.toThrow('Sonarr is not configured');
  });
});

// ─── sonarr_process_manual_import ────────────────────────────────────────────

describe('sonarr_process_manual_import', () => {
  it('posts items to /manualimport and returns success', async () => {
    let receivedItems: unknown[] = [];
    mswServer.use(http.post(`${API}/manualimport`, async ({ request }) => {
      receivedItems = await request.json() as unknown[];
      return new HttpResponse(null, { status: 204 });
    }));
    const items = [{ id: 1, path: '/downloads/show.mkv', relativePath: 'show.mkv', folderName: 'downloads', name: 'show', size: 1000, quality: { quality: { name: 'Bluray-1080p' }, revision: { version: 1 } }, rejections: [] }];
    const result = await sonarrModule.handlers['sonarr_process_manual_import']({ items }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(receivedItems).toHaveLength(1);
  });

  it('throws when sonarr is not configured', async () => {
    await expect(sonarrModule.handlers['sonarr_process_manual_import']({ items: [] }, {})).rejects.toThrow('Sonarr is not configured');
  });
});
