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
import { qualityProfileFixtures, customFormatFixtures, tagFixtures } from '../../fixtures/shared/config.js';

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
