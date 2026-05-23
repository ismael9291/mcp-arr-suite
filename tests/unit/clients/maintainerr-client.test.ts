import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MaintainerrClient } from '../../../src/clients/maintainerr-client.js';
import { mswServer } from '../../setup.js';
import {
  settingsFixture,
  ruleFixture,
  collectionFixture,
  plexLibrariesFixture,
} from '../../fixtures/maintainerr/data.js';

const BASE = 'http://maintainerr.test';
const API = `${BASE}/api`;

// ─── URL construction ─────────────────────────────────────────────────────────

describe('URL construction', () => {
  it('strips trailing slash from base URL', async () => {
    let calledUrl = '';
    mswServer.use(http.get(`${BASE}/api/settings`, ({ request }) => {
      calledUrl = request.url;
      return HttpResponse.json(settingsFixture);
    }));
    const client = new MaintainerrClient({ url: `${BASE}/` });
    await client.getSettings();
    expect(calledUrl).toBe(`${BASE}/api/settings`);
  });

  it('prepends /api to every endpoint', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${API}/plex/libraries`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json(plexLibrariesFixture);
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.getPlexLibraries();
    expect(calledPath).toBe('/api/plex/libraries');
  });
});

// ─── Authentication ───────────────────────────────────────────────────────────

describe('authentication', () => {
  it('sends X-Api-Key header when apiKey is configured', async () => {
    let receivedKey = '';
    mswServer.use(http.get(`${API}/settings`, ({ request }) => {
      receivedKey = request.headers.get('x-api-key') ?? '';
      return HttpResponse.json(settingsFixture);
    }));
    const client = new MaintainerrClient({ url: BASE, apiKey: 'my-secret-key' });
    await client.getSettings();
    expect(receivedKey).toBe('my-secret-key');
  });

  it('omits X-Api-Key header when apiKey is not set', async () => {
    let hasKey = false;
    mswServer.use(http.get(`${API}/settings`, ({ request }) => {
      hasKey = request.headers.has('x-api-key');
      return HttpResponse.json(settingsFixture);
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.getSettings();
    expect(hasKey).toBe(false);
  });
});

// ─── Content-type handling ────────────────────────────────────────────────────

describe('content-type handling', () => {
  it('parses JSON responses as objects', async () => {
    mswServer.use(http.get(`${API}/settings`, () => HttpResponse.json(settingsFixture)));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.getSettings();
    expect(result).toEqual(settingsFixture);
  });

  it('returns plain text for text/html responses (e.g. version endpoint)', async () => {
    mswServer.use(http.get(`${API}/settings/version`, () =>
      new HttpResponse('2.19.0', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    ));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.getVersion();
    expect(result).toBe('2.19.0');
  });

  it('returns plain text boolean string for setup check endpoint', async () => {
    mswServer.use(http.get(`${API}/settings/test/setup`, () =>
      new HttpResponse('true', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    ));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.checkSetup();
    expect(result).toBe('true');
  });

  it('returns undefined for 204 No Content responses', async () => {
    mswServer.use(http.delete(`${API}/rules/1`, () => new HttpResponse(null, { status: 204 })));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.deleteRule(1);
    expect(result).toBeUndefined();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('throws a descriptive error on non-OK response', async () => {
    mswServer.use(http.get(`${API}/settings`, () =>
      new HttpResponse('Unauthorized', { status: 401, statusText: 'Unauthorized' })
    ));
    const client = new MaintainerrClient({ url: BASE });
    await expect(client.getSettings()).rejects.toThrow('Maintainerr API error: 401 Unauthorized');
  });

  it('includes response body in error message', async () => {
    mswServer.use(http.get(`${API}/rules/999`, () =>
      new HttpResponse('Rule not found', { status: 404, statusText: 'Not Found' })
    ));
    const client = new MaintainerrClient({ url: BASE });
    await expect(client.getRule(999)).rejects.toThrow('Rule not found');
  });
});

// ─── Settings methods ─────────────────────────────────────────────────────────

describe('settings methods', () => {
  it('getSettings returns settings object', async () => {
    mswServer.use(http.get(`${API}/settings`, () => HttpResponse.json(settingsFixture)));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.getSettings();
    expect(result.id).toBe(1);
    expect(result.plex_name).toBe('My Plex Server');
  });

  it('updateSettings POSTs the full settings object', async () => {
    let body: unknown;
    mswServer.use(http.post(`${API}/settings`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(settingsFixture);
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.updateSettings(settingsFixture);
    expect(body).toEqual(settingsFixture);
  });

  it('setPlexToken POSTs the token', async () => {
    let body: unknown;
    mswServer.use(http.post(`${API}/settings/plex/token`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ status: 'OK' });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.setPlexToken('my-token');
    expect(body).toEqual({ token: 'my-token' });
  });

  it('validateCron POSTs the cron string', async () => {
    let body: unknown;
    mswServer.use(http.post(`${API}/settings/cron/validate`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ valid: true });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.validateCron('0 */8 * * *');
    expect(body).toEqual({ cron: '0 */8 * * *' });
  });
});

// ─── Plex methods ─────────────────────────────────────────────────────────────

describe('plex methods', () => {
  it('getPlexLibraries returns array', async () => {
    mswServer.use(http.get(`${API}/plex/libraries`, () => HttpResponse.json(plexLibrariesFixture)));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.getPlexLibraries();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ key: '1', type: 'movie', title: 'Movies' });
  });

  it('getLibraryContent defaults to page 1', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${API}/plex/library/1/content/1`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json({ items: [] });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.getLibraryContent('1');
    expect(calledPath).toBe('/api/plex/library/1/content/1');
  });

  it('searchLibrary encodes the query', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${API}/plex/library/1/content/search/star%20wars`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json([]);
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.searchLibrary('1', 'star wars');
    expect(calledPath).toBe('/api/plex/library/1/content/search/star%20wars');
  });

  it('createPlexCollection POSTs correct body', async () => {
    let body: unknown;
    mswServer.use(http.post(`${API}/plex/library/collection/create`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ id: '42' });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.createPlexCollection('1', 'My Collection', 1);
    expect(body).toEqual({ libraryId: '1', title: 'My Collection', type: 1 });
  });
});

// ─── Rules methods ────────────────────────────────────────────────────────────

describe('rules methods', () => {
  it('getRules returns array', async () => {
    mswServer.use(http.get(`${API}/rules`, () => HttpResponse.json([ruleFixture])));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.getRules();
    expect(result).toHaveLength(1);
  });

  it('getRule fetches by ID', async () => {
    mswServer.use(http.get(`${API}/rules/1`, () => HttpResponse.json(ruleFixture)));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.getRule(1);
    expect(result).toMatchObject({ id: 1, name: 'Unwatched Movies' });
  });

  it('createRule POSTs rule payload', async () => {
    let body: unknown;
    mswServer.use(http.post(`${API}/rules`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ ...ruleFixture, id: 2 });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.createRule({ name: 'Test', libraryId: 1, dataType: 1 });
    expect((body as Record<string, unknown>).name).toBe('Test');
  });

  it('deleteRule sends DELETE to /rules/:id', async () => {
    let calledPath = '';
    let method = '';
    mswServer.use(http.delete(`${API}/rules/5`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      method = request.method;
      return new HttpResponse(null, { status: 204 });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.deleteRule(5);
    expect(calledPath).toBe('/api/rules/5');
    expect(method).toBe('DELETE');
  });

  it('executeRules POSTs empty body', async () => {
    let body: unknown;
    mswServer.use(http.post(`${API}/rules/execute`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ status: 'started' });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.executeRules();
    expect(body).toEqual({});
  });

  it('addExclusion POSTs plexId and ruleGroupId', async () => {
    let body: unknown;
    mswServer.use(http.post(`${API}/rules/exclusion`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ id: 1 });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.addExclusion(12345, 1);
    expect(body).toEqual({ plexId: 12345, ruleGroupId: 1 });
  });

  it('deleteExclusionsForMedia sends DELETE to /rules/exclusions/:plexId', async () => {
    let calledPath = '';
    mswServer.use(http.delete(`${API}/rules/exclusions/12345`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return new HttpResponse(null, { status: 204 });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.deleteExclusionsForMedia(12345);
    expect(calledPath).toBe('/api/rules/exclusions/12345');
  });
});

// ─── Collections methods ──────────────────────────────────────────────────────

describe('collections methods', () => {
  it('getCollections returns array', async () => {
    mswServer.use(http.get(`${API}/collections`, () => HttpResponse.json([collectionFixture])));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.getCollections();
    expect(result).toHaveLength(1);
  });

  it('getCollection fetches by ID', async () => {
    mswServer.use(http.get(`${API}/collections/collection/1`, () => HttpResponse.json(collectionFixture)));
    const client = new MaintainerrClient({ url: BASE });
    const result = await client.getCollection(1);
    expect(result).toMatchObject({ id: 1, title: 'Unwatched Movies' });
  });

  it('activateCollection calls the correct endpoint', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${API}/collections/activate/3`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json({ success: true });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.activateCollection(3);
    expect(calledPath).toBe('/api/collections/activate/3');
  });

  it('addToCollection POSTs collectionId and plexId', async () => {
    let body: unknown;
    mswServer.use(http.post(`${API}/collections/media/add`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ success: true });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.addToCollection(1, 99999);
    expect(body).toEqual({ collectionId: 1, plexId: 99999 });
  });

  it('getCollectionLogs defaults to page 1', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${API}/collections/logs/2/content/1`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json({ items: [] });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.getCollectionLogs(2);
    expect(calledPath).toBe('/api/collections/logs/2/content/1');
  });

  it('updateCollectionsSchedule PUTs cron string', async () => {
    let body: unknown;
    mswServer.use(http.put(`${API}/collections/schedule/update`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ success: true });
    }));
    const client = new MaintainerrClient({ url: BASE });
    await client.updateCollectionsSchedule('0 0-23/6 * * *');
    expect(body).toEqual({ cron: '0 0-23/6 * * *' });
  });
});
