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
} from '../../fixtures/sonarr/series.js';

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
