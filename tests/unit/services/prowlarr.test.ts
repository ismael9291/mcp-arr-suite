import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { prowlarrModule } from '../../../src/services/prowlarr.js';
import { ProwlarrClient } from '../../../src/clients/arr-client.js';
import { mswServer } from '../../setup.js';
import {
  prowlarrIndexerFixtures,
  indexerStatsFixtures,
  prowlarrSearchResultFixtures,
  prowlarrHistoryFixtures,
  prowlarrTagFixtures,
  prowlarrDownloadClientFixtures,
  prowlarrApplicationFixtures,
} from '../../fixtures/prowlarr/indexers.js';
import { systemTaskFixtures, logPageFixture, notificationFixtures, importListFixtures, systemStatusFixture } from '../../fixtures/shared/config.js';

const BASE = 'http://prowlarr.test';
const API = `${BASE}/api/v1`;

let prowlarrClient: ProwlarrClient;
let clients: { prowlarr: ProwlarrClient };

beforeEach(() => {
  prowlarrClient = new ProwlarrClient({ url: BASE, apiKey: 'k' });
  clients = { prowlarr: prowlarrClient };
});

// ─── prowlarr_get_indexers ────────────────────────────────────────────────────

describe('prowlarr_get_indexers', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/indexer`, () => HttpResponse.json(prowlarrIndexerFixtures)));
  });

  it('returns count and indexer list', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_indexers']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(prowlarrIndexerFixtures.length);
    expect(data.indexers).toHaveLength(prowlarrIndexerFixtures.length);
  });

  it('returns expected indexer fields', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_indexers']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const idx = data.indexers[0];
    expect(idx).toHaveProperty('id');
    expect(idx).toHaveProperty('name');
    expect(idx).toHaveProperty('protocol');
    expect(idx).toHaveProperty('enableRss');
    expect(idx).toHaveProperty('priority');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_get_indexers']({}, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_search ──────────────────────────────────────────────────────────

describe('prowlarr_search', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/search`, () => HttpResponse.json(prowlarrSearchResultFixtures)));
  });

  it('returns results with expected fields', async () => {
    const result = await prowlarrModule.handlers['prowlarr_search']({ term: 'dune' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalResults).toBe(prowlarrSearchResultFixtures.length);
    expect(data.returned).toBe(prowlarrSearchResultFixtures.length);
    expect(data.results[0]).toHaveProperty('title');
    expect(data.results[0]).toHaveProperty('indexer');
    expect(data.results[0]).toHaveProperty('size');
    expect(data.results[0]).toHaveProperty('categories');
  });

  it('passes category filter as query params', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(
      http.get(`${API}/search`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await prowlarrModule.handlers['prowlarr_search']({ term: 'dune', categories: [2000, 2010] }, clients);
    expect(capturedUrl).toContain('categories=2000');
    expect(capturedUrl).toContain('categories=2010');
  });

  it('does not pass offset or limit to the API (handled client-side)', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(
      http.get(`${API}/search`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(prowlarrSearchResultFixtures);
      }),
    );
    await prowlarrModule.handlers['prowlarr_search']({ term: 'dune', offset: 25, limit: 50 }, clients);
    expect(capturedUrl).not.toContain('offset=');
    expect(capturedUrl).not.toContain('limit=');
  });

  it('slices results client-side to enforce limit', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...prowlarrSearchResultFixtures[0], title: `Result ${i}` }));
    mswServer.use(http.get(`${API}/search`, () => HttpResponse.json(many)));
    const result = await prowlarrModule.handlers['prowlarr_search']({ term: 'dune', limit: 10 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalResults).toBe(30);
    expect(data.returned).toBe(10);
    expect(data.results).toHaveLength(10);
    expect(data.hasMore).toBe(true);
  });

  it('defaults offset to 0 and limit to 25', async () => {
    const result = await prowlarrModule.handlers['prowlarr_search']({ term: 'dune' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.offset).toBe(0);
    expect(data.limit).toBe(25);
  });
});

// ─── prowlarr_test_indexers ───────────────────────────────────────────────────

describe('prowlarr_test_indexers', () => {
  it('returns healthy/failed counts', async () => {
    mswServer.use(
      http.get(`${API}/indexer`, () => HttpResponse.json(prowlarrIndexerFixtures)),
      http.post(`${API}/indexer/testall`, () =>
        HttpResponse.json([
          { id: 1, isValid: true, validationFailures: [] },
          { id: 2, isValid: false, validationFailures: [{ propertyName: 'ApiKey', errorMessage: 'Invalid API key' }] },
          { id: 3, isValid: true, validationFailures: [] },
        ]),
      ),
    );
    const result = await prowlarrModule.handlers['prowlarr_test_indexers']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(3);
    expect(data.healthy).toBe(2);
    expect(data.failed).toBe(1);
  });

  it('includes errors for failed indexers', async () => {
    mswServer.use(
      http.get(`${API}/indexer`, () => HttpResponse.json(prowlarrIndexerFixtures)),
      http.post(`${API}/indexer/testall`, () =>
        HttpResponse.json([
          { id: 2, isValid: false, validationFailures: [{ propertyName: 'ApiKey', errorMessage: 'Invalid API key' }] },
        ]),
      ),
    );
    const result = await prowlarrModule.handlers['prowlarr_test_indexers']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const failed = data.indexers.find((i: { isValid: boolean; errors: string[] }) => !i.isValid);
    expect(failed.errors).toContain('Invalid API key');
  });
});

// ─── prowlarr_get_stats ───────────────────────────────────────────────────────

describe('prowlarr_get_stats', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/indexerstats`, () => HttpResponse.json({ indexers: indexerStatsFixtures })));
  });

  it('returns totals across all indexers', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_stats']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const expectedQueries = indexerStatsFixtures.reduce((s, i) => s + i.numberOfQueries, 0);
    expect(data.totals.queries).toBe(expectedQueries);
    expect(data.totals).toHaveProperty('grabs');
    expect(data.totals).toHaveProperty('failedQueries');
    expect(data.totals).toHaveProperty('failedGrabs');
  });

  it('returns per-indexer stats with avgResponseTime', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_stats']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.indexers[0].avgResponseTime).toBe('450ms');
    expect(data.indexers[0]).toHaveProperty('name');
  });
});

// ─── prowlarr_get_health ──────────────────────────────────────────────────────

describe('prowlarr_get_health', () => {
  it('returns healthy status when no issues', async () => {
    mswServer.use(http.get(`${API}/health`, () => HttpResponse.json([])));
    const result = await prowlarrModule.handlers['prowlarr_get_health']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe('healthy');
    expect(data.issueCount).toBe(0);
  });

  it('returns issues when health checks fail', async () => {
    mswServer.use(
      http.get(`${API}/health`, () =>
        HttpResponse.json([{ source: 'IndexerStatusCheck', type: 'warning', message: 'Indexer unavailable', wikiUrl: '' }]),
      ),
    );
    const result = await prowlarrModule.handlers['prowlarr_get_health']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe('issues detected');
    expect(data.issueCount).toBe(1);
    expect(data.issues[0].source).toBe('IndexerStatusCheck');
  });
});

// ─── prowlarr_get_history ─────────────────────────────────────────────────────

describe('prowlarr_get_history', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/history`, () => HttpResponse.json(prowlarrHistoryFixtures)));
  });

  it('returns paged history records', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_history']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(prowlarrHistoryFixtures.totalRecords);
    expect(data.records).toHaveLength(prowlarrHistoryFixtures.records.length);
  });

  it('returns expected record fields', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_history']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const rec = data.records[0];
    expect(rec).toHaveProperty('id');
    expect(rec).toHaveProperty('indexer');
    expect(rec).toHaveProperty('date');
    expect(rec).toHaveProperty('eventType');
    expect(rec).toHaveProperty('successful');
  });

  it('defaults to page 1 and pageSize 20', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(
      http.get(`${API}/history`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(prowlarrHistoryFixtures);
      }),
    );
    await prowlarrModule.handlers['prowlarr_get_history']({}, clients);
    expect(capturedUrl).toContain('page=1');
    expect(capturedUrl).toContain('pageSize=20');
  });

  it('passes indexerId filter when provided', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(
      http.get(`${API}/history`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(prowlarrHistoryFixtures);
      }),
    );
    await prowlarrModule.handlers['prowlarr_get_history']({ indexerId: 1 }, clients);
    expect(capturedUrl).toContain('indexerId=1');
  });
});

// ─── prowlarr_get_tags ────────────────────────────────────────────────────────

describe('prowlarr_get_tags', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/tag`, () => HttpResponse.json(prowlarrTagFixtures)));
  });

  it('returns all tags with count', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_tags']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(prowlarrTagFixtures.length);
    expect(data.tags[0]).toHaveProperty('id');
    expect(data.tags[0]).toHaveProperty('label');
  });
});

// ─── prowlarr_get_download_clients ────────────────────────────────────────────

describe('prowlarr_get_download_clients', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/downloadclient`, () => HttpResponse.json(prowlarrDownloadClientFixtures)));
  });

  it('returns download clients with expected fields', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_download_clients']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(prowlarrDownloadClientFixtures.length);
    const client = data.downloadClients[0];
    expect(client).toHaveProperty('id');
    expect(client).toHaveProperty('name');
    expect(client).toHaveProperty('protocol');
    expect(client).toHaveProperty('enable');
    expect(client).toHaveProperty('priority');
  });
});

// ─── prowlarr_get_apps ────────────────────────────────────────────────────────

describe('prowlarr_get_apps', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/applications`, () => HttpResponse.json(prowlarrApplicationFixtures)));
  });

  it('returns connected applications with count', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_apps']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(prowlarrApplicationFixtures.length);
    expect(data.applications).toHaveLength(prowlarrApplicationFixtures.length);
  });

  it('returns expected application fields', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_apps']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const app = data.applications[0];
    expect(app).toHaveProperty('id');
    expect(app).toHaveProperty('name');
    expect(app).toHaveProperty('syncLevel');
    expect(app).toHaveProperty('enable');
  });

  it('includes Sonarr and Radarr in fixture apps', async () => {
    const result = await prowlarrModule.handlers['prowlarr_get_apps']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const names = data.applications.map((a: { name: string }) => a.name);
    expect(names).toContain('Radarr');
    expect(names).toContain('Sonarr');
  });
});

// ─── prowlarr_create_tag ──────────────────────────────────────────────────────

describe('prowlarr_create_tag', () => {
  it('posts new tag and returns success with id and label', async () => {
    mswServer.use(http.post(`${API}/tag`, () => HttpResponse.json({ id: 10, label: 'my-tag' }, { status: 201 })));
    const result = await prowlarrModule.handlers['prowlarr_create_tag']({ label: 'my-tag' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.id).toBe(10);
    expect(data.message).toContain('my-tag');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_create_tag']({ label: 'x' }, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_delete_tag ──────────────────────────────────────────────────────

describe('prowlarr_delete_tag', () => {
  it('deletes tag and returns success', async () => {
    mswServer.use(http.delete(`${API}/tag/10`, () => new HttpResponse(null, { status: 204 })));
    const result = await prowlarrModule.handlers['prowlarr_delete_tag']({ tagId: 10 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.message).toContain('10');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_delete_tag']({ tagId: 1 }, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_get_logs ────────────────────────────────────────────────────────

describe('prowlarr_get_logs', () => {
  it('returns log entries with level and message', async () => {
    mswServer.use(http.get(`${API}/log`, () => HttpResponse.json(logPageFixture)));
    const result = await prowlarrModule.handlers['prowlarr_get_logs']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(logPageFixture.totalRecords);
    expect(data.records[0].level).toBe('info');
    expect(data.records[1].level).toBe('warn');
    expect(data.records[1]).toHaveProperty('exception');
  });

  it('defaults to page 1 and pageSize 20', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(`${API}/log`, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json(logPageFixture);
    }));
    await prowlarrModule.handlers['prowlarr_get_logs']({}, clients);
    expect(capturedUrl).toContain('page=1');
    expect(capturedUrl).toContain('pageSize=20');
  });

  it('caps pageSize at 100', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(`${API}/log`, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json(logPageFixture);
    }));
    await prowlarrModule.handlers['prowlarr_get_logs']({ pageSize: 999 }, clients);
    expect(capturedUrl).toContain('pageSize=100');
  });

  it('passes level filter when provided', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(`${API}/log`, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json(logPageFixture);
    }));
    await prowlarrModule.handlers['prowlarr_get_logs']({ level: 'error' }, clients);
    expect(capturedUrl).toContain('level=error');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_get_logs']({}, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_get_system_tasks ────────────────────────────────────────────────

describe('prowlarr_get_system_tasks', () => {
  it('returns system tasks with timing fields', async () => {
    mswServer.use(http.get(`${API}/system/task`, () => HttpResponse.json(systemTaskFixtures)));
    const result = await prowlarrModule.handlers['prowlarr_get_system_tasks']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(systemTaskFixtures.length);
    expect(data.tasks[0].name).toBe('Housekeeping');
    expect(data.tasks[0]).toHaveProperty('nextExecution');
    expect(data.tasks[0]).toHaveProperty('isRunning');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_get_system_tasks']({}, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_get_command_status ──────────────────────────────────────────────

describe('prowlarr_get_command_status', () => {
  const commandResponse = { id: 42, name: 'Backup', status: 'completed', message: 'Completed', started: '2024-03-01T00:00:00Z', ended: '2024-03-01T00:01:00Z' };

  it('returns command status fields', async () => {
    mswServer.use(http.get(`${API}/command/42`, () => HttpResponse.json(commandResponse)));
    const result = await prowlarrModule.handlers['prowlarr_get_command_status']({ commandId: 42 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(42);
    expect(data.status).toBe('completed');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_get_command_status']({ commandId: 1 }, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_trigger_backup ──────────────────────────────────────────────────

describe('prowlarr_trigger_backup', () => {
  it('posts Backup command and returns commandId', async () => {
    mswServer.use(http.post(`${API}/command`, () => HttpResponse.json({ id: 99 })));
    const result = await prowlarrModule.handlers['prowlarr_trigger_backup']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(99);
    expect(data.message).toContain('triggered');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_trigger_backup']({}, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_get_notifications ───────────────────────────────────────────────

describe('prowlarr_get_notifications', () => {
  it('returns notification list with implementation and trigger flags', async () => {
    mswServer.use(http.get(`${API}/notification`, () => HttpResponse.json(notificationFixtures)));
    const result = await prowlarrModule.handlers['prowlarr_get_notifications']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(notificationFixtures.length);
    expect(data.notifications[0].name).toBe('Slack');
    expect(data.notifications[0].implementation).toBe('Slack');
    expect(data.notifications[0].triggers).toHaveProperty('onGrab');
    expect(data.notifications[0].triggers).toHaveProperty('onHealthIssue');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_get_notifications']({}, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_get_status ──────────────────────────────────────────────────────

describe('prowlarr_get_status', () => {
  it('returns trimmed status fields', async () => {
    mswServer.use(http.get(`${API}/system/status`, () => HttpResponse.json({
      ...systemStatusFixture,
      runtimeVersion: '8.0.4',
      branch: 'main',
      authentication: 'none',
    })));
    const result = await prowlarrModule.handlers['prowlarr_get_status']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.version).toBe(systemStatusFixture.version);
    expect(data.buildTime).toBe(systemStatusFixture.buildTime);
    expect(data.isDebug).toBe(false);
    expect(data.appData).toBe(systemStatusFixture.appData);
    expect(data.osName).toBe(systemStatusFixture.osName);
    expect(data.runtimeVersion).toBe('8.0.4');
    expect(data).not.toHaveProperty('branch');
    expect(data).not.toHaveProperty('authentication');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_get_status']({}, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_trigger_rss_sync ────────────────────────────────────────────────

describe('prowlarr_trigger_rss_sync', () => {
  it('posts RssSync command and returns commandId', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 200 });
    }));
    const result = await prowlarrModule.handlers['prowlarr_trigger_rss_sync']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(200);
    expect(commandName).toBe('RssSync');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_trigger_rss_sync']({}, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_sync_apps ───────────────────────────────────────────────────────

describe('prowlarr_sync_apps', () => {
  it('posts ApplicationIndexerSync and returns commandId with message', async () => {
    let commandName = '';
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      const body = await request.json() as { name: string };
      commandName = body.name;
      return HttpResponse.json({ id: 201 });
    }));
    const result = await prowlarrModule.handlers['prowlarr_sync_apps']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(201);
    expect(data.message).toContain('Sync triggered');
    expect(commandName).toBe('ApplicationIndexerSync');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_sync_apps']({}, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_test_indexer ────────────────────────────────────────────────────

describe('prowlarr_test_indexer', () => {
  it('returns valid result — GETs indexer then POSTs full object to /indexer/test', async () => {
    let postedBody: Record<string, unknown> = {};
    mswServer.use(
      http.get(`${API}/indexer/1`, () => HttpResponse.json({ ...prowlarrIndexerFixtures[0], fields: [] })),
      http.post(`${API}/indexer/test`, async ({ request }) => {
        postedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 1, isValid: true, validationFailures: [] });
      }),
    );
    const result = await prowlarrModule.handlers['prowlarr_test_indexer']({ id: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(1);
    expect(data.name).toBe('NZBgeek');
    expect(data.isValid).toBe(true);
    expect(data.errors).toHaveLength(0);
    expect(postedBody['name']).toBe('NZBgeek');
  });

  it('returns errors for invalid indexer', async () => {
    mswServer.use(
      http.get(`${API}/indexer/2`, () => HttpResponse.json({ ...prowlarrIndexerFixtures[1], fields: [] })),
      http.post(`${API}/indexer/test`, () => HttpResponse.json({
        id: 2, isValid: false,
        validationFailures: [{ propertyName: 'ApiKey', errorMessage: 'Invalid API key' }],
      })),
    );
    const result = await prowlarrModule.handlers['prowlarr_test_indexer']({ id: 2 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.isValid).toBe(false);
    expect(data.errors).toContain('Invalid API key');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_test_indexer']({ id: 1 }, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_update_indexer ──────────────────────────────────────────────────

describe('prowlarr_update_indexer', () => {
  it('fetches current indexer, applies patch, and PUTs back', async () => {
    let putBody: Record<string, unknown> = {};
    mswServer.use(
      http.get(`${API}/indexer/1`, () => HttpResponse.json({ ...prowlarrIndexerFixtures[0], fields: [] })),
      http.put(`${API}/indexer/1`, async ({ request }) => {
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...prowlarrIndexerFixtures[0], enableRss: false });
      }),
    );
    const result = await prowlarrModule.handlers['prowlarr_update_indexer']({ id: 1, enableRss: false }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.id).toBe(1);
    expect(data.name).toBe('NZBgeek');
    expect(data.changes).toEqual({ enableRss: false });
    expect(putBody['enableRss']).toBe(false);
  });

  it('only echoes changed fields in response', async () => {
    mswServer.use(
      http.get(`${API}/indexer/1`, () => HttpResponse.json({ ...prowlarrIndexerFixtures[0], fields: [] })),
      http.put(`${API}/indexer/1`, () => HttpResponse.json({ ...prowlarrIndexerFixtures[0], priority: 10 })),
    );
    const result = await prowlarrModule.handlers['prowlarr_update_indexer']({ id: 1, priority: 10 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(Object.keys(data.changes)).toEqual(['priority']);
    expect(data.changes.priority).toBe(10);
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_update_indexer']({ id: 1, enableRss: true }, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_get_indexer ─────────────────────────────────────────────────────

describe('prowlarr_get_indexer', () => {
  it('returns single indexer fields without fields[] array', async () => {
    mswServer.use(http.get(`${API}/indexer/1`, () => HttpResponse.json({
      ...prowlarrIndexerFixtures[0],
      fields: [{ name: 'apiKey', value: 'secret' }],
    })));
    const result = await prowlarrModule.handlers['prowlarr_get_indexer']({ id: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(1);
    expect(data.name).toBe('NZBgeek');
    expect(data.protocol).toBe('usenet');
    expect(data.enableRss).toBe(true);
    expect(data.priority).toBe(25);
    expect(data).not.toHaveProperty('fields');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_get_indexer']({ id: 1 }, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_update_app ──────────────────────────────────────────────────────

describe('prowlarr_update_app', () => {
  it('fetches application, patches syncLevel, and PUTs back', async () => {
    let putBody: Record<string, unknown> = {};
    mswServer.use(
      http.get(`${API}/applications/1`, () => HttpResponse.json(prowlarrApplicationFixtures[0])),
      http.put(`${API}/applications/1`, async ({ request }) => {
        putBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...prowlarrApplicationFixtures[0], syncLevel: 'addOnly' });
      }),
    );
    const result = await prowlarrModule.handlers['prowlarr_update_app']({ id: 1, syncLevel: 'addOnly' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.id).toBe(1);
    expect(data.name).toBe('Radarr');
    expect(data.syncLevel).toBe('addOnly');
    expect(putBody['syncLevel']).toBe('addOnly');
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_update_app']({ id: 1, syncLevel: 'disabled' }, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

// ─── prowlarr_test_notification ───────────────────────────────────────────────

describe('prowlarr_test_notification', () => {
  it('posts TestNotification command with notificationId', async () => {
    let commandBody: Record<string, unknown> = {};
    mswServer.use(http.post(`${API}/command`, async ({ request }) => {
      commandBody = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 202 });
    }));
    const result = await prowlarrModule.handlers['prowlarr_test_notification']({ notificationId: 5 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.commandId).toBe(202);
    expect(data.message).toContain('notification');
    expect(commandBody['name']).toBe('TestNotification');
    expect(commandBody['notificationId']).toBe(5);
  });

  it('throws when prowlarr is not configured', async () => {
    await expect(prowlarrModule.handlers['prowlarr_test_notification']({ notificationId: 1 }, {})).rejects.toThrow('Prowlarr is not configured');
  });
});

