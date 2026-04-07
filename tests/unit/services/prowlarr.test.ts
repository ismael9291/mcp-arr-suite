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
