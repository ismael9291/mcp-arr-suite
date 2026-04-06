import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { lidarrModule } from '../../../src/services/lidarr.js';
import { LidarrClient } from '../../../src/clients/arr-client.js';
import { mswServer } from '../../setup.js';
import {
  artistFixtures,
  albumFixtures,
  metadataProfileFixtures,
  artistSearchResultFixtures,
  trackFileFixtures,
  lidarrHistoryFixture,
  lidarrBlocklistFixture,
  lidarrWantedMissingFixture,
  lidarrWantedCutoffFixture,
  lidarrDiskSpaceFixtures,
} from '../../fixtures/lidarr/artists.js';
import { qualityProfileFixtures } from '../../fixtures/shared/config.js';

const BASE = 'http://lidarr.test';
const KEY = 'test-key';
const API = `${BASE}/api/v1`;

let lidarrClient: LidarrClient;
let clients: { lidarr: LidarrClient };

beforeEach(() => {
  lidarrClient = new LidarrClient({ url: BASE, apiKey: KEY });
  clients = { lidarr: lidarrClient };
});

// ─── lidarr_get_artists ───────────────────────────────────────────────────────

describe('lidarr_get_artists', () => {
  beforeEach(() => {
    mswServer.use(http.get(`${API}/artist`, () => HttpResponse.json(artistFixtures)));
  });

  it('returns paginated results', async () => {
    const result = await lidarrModule.handlers['lidarr_get_artists']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(artistFixtures.length);
    expect(data.items).toHaveLength(artistFixtures.length);
  });

  it('returns summary fields only', async () => {
    const result = await lidarrModule.handlers['lidarr_get_artists']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const item = data.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('artistName');
    expect(item).toHaveProperty('monitored');
    expect(item).toHaveProperty('sizeOnDisk');
    expect(item).not.toHaveProperty('overview');
    expect(item).not.toHaveProperty('genres');
  });

  it('formats sizeOnDisk as human-readable', async () => {
    const result = await lidarrModule.handlers['lidarr_get_artists']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0].sizeOnDisk).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
  });

  it('filters by search term (case-insensitive)', async () => {
    const result = await lidarrModule.handlers['lidarr_get_artists']({ search: 'pink' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items.every((a: { artistName: string }) => a.artistName.toLowerCase().includes('pink'))).toBe(true);
  });

  it('paginates with limit and offset', async () => {
    const result = await lidarrModule.handlers['lidarr_get_artists']({ limit: 1, offset: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.returned).toBe(1);
    expect(data.items[0].artistName).toBe(artistFixtures[1].artistName);
  });

  it('throws when lidarr is not configured', async () => {
    await expect(lidarrModule.handlers['lidarr_get_artists']({}, {})).rejects.toThrow('Lidarr is not configured');
  });
});

// ─── lidarr_search ────────────────────────────────────────────────────────────

describe('lidarr_search', () => {
  it('returns trimmed search results', async () => {
    mswServer.use(http.get(`${API}/artist/lookup`, () => HttpResponse.json(artistSearchResultFixtures)));
    const result = await lidarrModule.handlers['lidarr_search']({ term: 'Led Zeppelin' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(artistSearchResultFixtures.length);
    expect(data.results[0]).toHaveProperty('foreignArtistId');
    expect(data.results[0]).toHaveProperty('artistName');
  });

  it('limits results to 10', async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ ...artistSearchResultFixtures[0], foreignArtistId: `id-${i}` }));
    mswServer.use(http.get(`${API}/artist/lookup`, () => HttpResponse.json(many)));
    const result = await lidarrModule.handlers['lidarr_search']({ term: 'x' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(10);
  });
});

// ─── lidarr_get_albums ────────────────────────────────────────────────────────

describe('lidarr_get_albums', () => {
  it('returns albums for an artist with stats', async () => {
    mswServer.use(http.get(`${API}/album`, () => HttpResponse.json(albumFixtures)));
    const result = await lidarrModule.handlers['lidarr_get_albums']({ artistId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(albumFixtures.length);
    expect(data.albums[0]).toHaveProperty('id');
    expect(data.albums[0]).toHaveProperty('title');
    expect(data.albums[0]).toHaveProperty('tracks');
    expect(data.albums[0].sizeOnDisk).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
  });
});

// ─── lidarr_get_queue ─────────────────────────────────────────────────────────

describe('lidarr_get_queue', () => {
  it('returns queue items with progress', async () => {
    const queueResponse = {
      totalRecords: 1,
      records: [{
        id: 1,
        title: 'Pink Floyd - Wish You Were Here',
        status: 'downloading',
        trackedDownloadStatus: 'ok',
        trackedDownloadState: 'downloading',
        statusMessages: [],
        downloadId: 'abc123',
        protocol: 'usenet',
        downloadClient: 'SABnzbd',
        outputPath: '',
        sizeleft: 250_000_000,
        size: 500_000_000,
        timeleft: '00:15:00',
        estimatedCompletionTime: '2024-01-15T11:00:00Z',
      }],
    };
    mswServer.use(http.get(`${API}/queue`, () => HttpResponse.json(queueResponse)));
    const result = await lidarrModule.handlers['lidarr_get_queue']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(1);
    expect(data.items[0].progress).toBe('50.0%');
  });
});

// ─── lidarr_get_metadata_profiles ────────────────────────────────────────────

describe('lidarr_get_metadata_profiles', () => {
  it('returns profile list', async () => {
    mswServer.use(http.get(`${API}/metadataprofile`, () => HttpResponse.json(metadataProfileFixtures)));
    const result = await lidarrModule.handlers['lidarr_get_metadata_profiles']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(metadataProfileFixtures.length);
    expect(data.profiles[0]).toHaveProperty('id');
    expect(data.profiles[0]).toHaveProperty('name');
  });
});

// ─── lidarr_delete_artist ─────────────────────────────────────────────────────

describe('lidarr_delete_artist', () => {
  it('returns success message with artist name', async () => {
    mswServer.use(
      http.get(`${API}/artist/1`, () => HttpResponse.json(artistFixtures[0])),
      http.delete(`${API}/artist/1`, () => new HttpResponse(null, { status: 204 })),
    );
    const result = await lidarrModule.handlers['lidarr_delete_artist']({ artistId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.message).toContain('Pink Floyd');
    expect(data.deletedFiles).toBe(false);
    expect(data.addedToExclusions).toBe(false);
  });

  it('passes deleteFiles and addImportListExclusion flags', async () => {
    let calledUrl = '';
    mswServer.use(
      http.get(`${API}/artist/1`, () => HttpResponse.json(artistFixtures[0])),
      http.delete(`${API}/artist/1`, ({ request }) => {
        calledUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const result = await lidarrModule.handlers['lidarr_delete_artist'](
      { artistId: 1, deleteFiles: true, addImportListExclusion: true },
      clients
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.deletedFiles).toBe(true);
    expect(data.addedToExclusions).toBe(true);
    expect(calledUrl).toContain('deleteFiles=true');
    expect(calledUrl).toContain('addImportListExclusion=true');
  });

  it('throws when lidarr is not configured', async () => {
    await expect(lidarrModule.handlers['lidarr_delete_artist']({ artistId: 1 }, {})).rejects.toThrow('Lidarr is not configured');
  });
});

// ─── lidarr_update_artist ─────────────────────────────────────────────────────

describe('lidarr_update_artist', () => {
  it('updates monitored state and returns updated fields', async () => {
    const updated = { ...artistFixtures[0], monitored: false };
    mswServer.use(
      http.get(`${API}/artist/1`, () => HttpResponse.json(artistFixtures[0])),
      http.put(`${API}/artist/1`, () => HttpResponse.json(updated)),
    );
    const result = await lidarrModule.handlers['lidarr_update_artist']({ artistId: 1, monitored: false }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.monitored).toBe(false);
    expect(data.artistName).toBe('Pink Floyd');
  });

  it('sends merged object to PUT endpoint', async () => {
    let sentBody: Record<string, unknown> = {};
    mswServer.use(
      http.get(`${API}/artist/1`, () => HttpResponse.json(artistFixtures[0])),
      http.put(`${API}/artist/1`, async ({ request }) => {
        sentBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ ...artistFixtures[0], ...sentBody });
      }),
    );
    await lidarrModule.handlers['lidarr_update_artist']({ artistId: 1, qualityProfileId: 99 }, clients);
    expect(sentBody.qualityProfileId).toBe(99);
    // Should include all existing fields from the GET
    expect(sentBody.artistName).toBe('Pink Floyd');
  });
});

// ─── lidarr_remove_from_queue ─────────────────────────────────────────────────

describe('lidarr_remove_from_queue', () => {
  it('uses single DELETE for one id', async () => {
    let calledId = '';
    mswServer.use(http.delete(`${API}/queue/:id`, ({ params }) => {
      calledId = params['id'] as string;
      return new HttpResponse(null, { status: 204 });
    }));
    const result = await lidarrModule.handlers['lidarr_remove_from_queue']({ ids: [42] }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(calledId).toBe('42');
  });

  it('uses bulk DELETE for multiple ids', async () => {
    let bulkCalled = false;
    mswServer.use(http.delete(`${API}/queue/bulk`, () => {
      bulkCalled = true;
      return new HttpResponse(null, { status: 204 });
    }));
    const result = await lidarrModule.handlers['lidarr_remove_from_queue']({ ids: [1, 2, 3] }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(bulkCalled).toBe(true);
    expect(data.ids).toEqual([1, 2, 3]);
  });
});

// ─── lidarr_get_blocklist ─────────────────────────────────────────────────────

describe('lidarr_get_blocklist', () => {
  it('returns paginated blocklist entries', async () => {
    const paged = { records: lidarrBlocklistFixture, totalRecords: 1, page: 1, pageSize: 20 };
    mswServer.use(http.get(`${API}/blocklist`, () => HttpResponse.json(paged)));
    const result = await lidarrModule.handlers['lidarr_get_blocklist']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(1);
    expect(data.entries[0].sourceTitle).toBe(lidarrBlocklistFixture[0].sourceTitle);
    expect(data.entries[0].message).toBe('Release was corrupt');
  });
});

// ─── lidarr_delete_from_blocklist ─────────────────────────────────────────────

describe('lidarr_delete_from_blocklist', () => {
  it('calls delete and returns success', async () => {
    mswServer.use(http.delete(`${API}/blocklist/301`, () => new HttpResponse(null, { status: 204 })));
    const result = await lidarrModule.handlers['lidarr_delete_from_blocklist']({ blocklistId: 301 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});

// ─── lidarr_get_wanted_missing ────────────────────────────────────────────────

describe('lidarr_get_wanted_missing', () => {
  it('returns paginated wanted missing albums', async () => {
    mswServer.use(http.get(`${API}/wanted/missing`, () => HttpResponse.json(lidarrWantedMissingFixture)));
    const result = await lidarrModule.handlers['lidarr_get_wanted_missing']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(lidarrWantedMissingFixture.totalRecords);
    expect(data.albums[0]).toHaveProperty('id');
    expect(data.albums[0]).toHaveProperty('title');
    expect(data.albums[0]).toHaveProperty('artistId');
    expect(data.albums[0]).not.toHaveProperty('overview');
  });

  it('computes hasMore correctly', async () => {
    const manyRecords = { ...lidarrWantedMissingFixture, totalRecords: 50, page: 1, pageSize: 20 };
    mswServer.use(http.get(`${API}/wanted/missing`, () => HttpResponse.json(manyRecords)));
    const result = await lidarrModule.handlers['lidarr_get_wanted_missing']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.hasMore).toBe(true);
  });
});

// ─── lidarr_get_wanted_cutoff ─────────────────────────────────────────────────

describe('lidarr_get_wanted_cutoff', () => {
  it('returns paginated cutoff unmet albums', async () => {
    mswServer.use(http.get(`${API}/wanted/cutoff`, () => HttpResponse.json(lidarrWantedCutoffFixture)));
    const result = await lidarrModule.handlers['lidarr_get_wanted_cutoff']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(lidarrWantedCutoffFixture.totalRecords);
    expect(data.albums[0]).toHaveProperty('id');
    expect(data.albums[0]).toHaveProperty('title');
  });
});

// ─── lidarr_get_disk_space ────────────────────────────────────────────────────

describe('lidarr_get_disk_space', () => {
  it('returns formatted disk info', async () => {
    mswServer.use(http.get(`${API}/diskspace`, () => HttpResponse.json(lidarrDiskSpaceFixtures)));
    const result = await lidarrModule.handlers['lidarr_get_disk_space']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(1);
    expect(data.disks[0].path).toBe('/music');
    expect(data.disks[0].freeSpace).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
    expect(data.disks[0].totalSpace).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
    expect(data.disks[0].freePercent).toMatch(/\d+\.\d+%/);
  });

  it('computes usedSpace correctly', async () => {
    mswServer.use(http.get(`${API}/diskspace`, () => HttpResponse.json(lidarrDiskSpaceFixtures)));
    const result = await lidarrModule.handlers['lidarr_get_disk_space']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.disks[0].usedSpace).toBeTruthy();
  });
});

// ─── lidarr_get_track_files ───────────────────────────────────────────────────

describe('lidarr_get_track_files', () => {
  it('returns file list with human-readable size and audio info', async () => {
    mswServer.use(http.get(`${API}/trackfile`, () => HttpResponse.json(trackFileFixtures)));
    const result = await lidarrModule.handlers['lidarr_get_track_files']({ artistId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(trackFileFixtures.length);
    expect(data.files[0].size).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
    expect(data.files[0].quality).toBe('FLAC');
    expect(data.files[0].audioFormat).toBe('FLAC');
    expect(data.files[0].audioChannels).toBe(2);
  });

  it('passes artistId as query param', async () => {
    let calledUrl = '';
    mswServer.use(http.get(`${API}/trackfile`, ({ request }) => {
      calledUrl = request.url;
      return HttpResponse.json([]);
    }));
    await lidarrModule.handlers['lidarr_get_track_files']({ artistId: 99 }, clients);
    expect(calledUrl).toContain('artistId=99');
  });
});

// ─── lidarr_delete_track_file ─────────────────────────────────────────────────

describe('lidarr_delete_track_file', () => {
  it('deletes a track file and returns success', async () => {
    mswServer.use(http.delete(`${API}/trackfile/501`, () => new HttpResponse(null, { status: 204 })));
    const result = await lidarrModule.handlers['lidarr_delete_track_file']({ fileId: 501 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});

// ─── lidarr_refresh_artist ────────────────────────────────────────────────────

describe('lidarr_refresh_artist', () => {
  it('triggers refresh and returns artist info + commandId', async () => {
    mswServer.use(
      http.get(`${API}/artist/1`, () => HttpResponse.json(artistFixtures[0])),
      http.post(`${API}/command`, () => HttpResponse.json({ id: 999 })),
    );
    const result = await lidarrModule.handlers['lidarr_refresh_artist']({ artistId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.artist.artistName).toBe('Pink Floyd');
    expect(data.commandId).toBe(999);
  });
});

// ─── lidarr_get_history ───────────────────────────────────────────────────────

describe('lidarr_get_history', () => {
  it('returns paginated history records', async () => {
    const paged = { records: lidarrHistoryFixture, totalRecords: 2 };
    mswServer.use(http.get(`${API}/history`, () => HttpResponse.json(paged)));
    const result = await lidarrModule.handlers['lidarr_get_history']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.totalRecords).toBe(2);
    expect(data.records[0].eventType).toBe('downloadFolderImported');
    expect(data.records[0]).toHaveProperty('artistId');
    expect(data.records[0]).toHaveProperty('albumId');
  });

  it('includes artistId in params when provided', async () => {
    let calledUrl = '';
    mswServer.use(http.get(`${API}/history`, ({ request }) => {
      calledUrl = request.url;
      return HttpResponse.json({ records: [], totalRecords: 0 });
    }));
    await lidarrModule.handlers['lidarr_get_history']({ artistId: 1 }, clients);
    expect(calledUrl).toContain('artistId=1');
    const result = await lidarrModule.handlers['lidarr_get_history']({ artistId: 1 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.artistId).toBe(1);
  });

  it('does not include artistId in response when not provided', async () => {
    mswServer.use(http.get(`${API}/history`, () => HttpResponse.json({ records: [], totalRecords: 0 })));
    const result = await lidarrModule.handlers['lidarr_get_history']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data).not.toHaveProperty('artistId');
  });
});

// ─── lidarr_monitor_albums ────────────────────────────────────────────────────

describe('lidarr_monitor_albums', () => {
  it('sets albums to monitored and returns confirmation', async () => {
    let sentBody: Record<string, unknown> = {};
    mswServer.use(http.put(`${API}/album/monitor`, async ({ request }) => {
      sentBody = await request.json() as Record<string, unknown>;
      return new HttpResponse(null, { status: 204 });
    }));
    const result = await lidarrModule.handlers['lidarr_monitor_albums']({ albumIds: [101, 102], monitored: true }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.albumIds).toEqual([101, 102]);
    expect(data.monitored).toBe(true);
    expect(sentBody.albumIds).toEqual([101, 102]);
    expect(sentBody.monitored).toBe(true);
  });

  it('sets albums to unmonitored', async () => {
    mswServer.use(http.put(`${API}/album/monitor`, () => new HttpResponse(null, { status: 204 })));
    const result = await lidarrModule.handlers['lidarr_monitor_albums']({ albumIds: [101], monitored: false }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.monitored).toBe(false);
    expect(data.message).toContain('unmonitored');
  });
});

// ─── lidarr_add_artist ───────────────────────────────────────────────────────

describe('lidarr_add_artist', () => {
  it('adds an artist and returns id, path, monitored', async () => {
    mswServer.use(http.post(`${API}/artist`, () => HttpResponse.json(artistFixtures[0])));
    const result = await lidarrModule.handlers['lidarr_add_artist']({
      foreignArtistId: 'b7ffd2af-418f-4be2-bdd1-22f8b48613da',
      artistName: 'Pink Floyd',
      qualityProfileId: 1,
      metadataProfileId: 1,
      rootFolderPath: '/music',
    }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.id).toBe(artistFixtures[0].id);
    expect(data.monitored).toBe(true);
  });
});

// ─── lidarr_get_calendar ─────────────────────────────────────────────────────

describe('lidarr_get_calendar', () => {
  it('returns upcoming albums', async () => {
    mswServer.use(http.get(`${API}/calendar`, () => HttpResponse.json(albumFixtures)));
    const result = await lidarrModule.handlers['lidarr_get_calendar']({ days: 30 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(albumFixtures.length);
    expect(data.albums[0]).toHaveProperty('id');
    expect(data.albums[0]).toHaveProperty('title');
    expect(data.albums[0]).toHaveProperty('releaseDate');
  });
});

// ─── quality profiles (via shared config tools) ───────────────────────────────

describe('lidarr_get_quality_profiles', () => {
  it('uses /api/v1/ path', async () => {
    let calledPath = '';
    mswServer.use(http.get(`${BASE}/api/v1/qualityprofile`, ({ request }) => {
      calledPath = new URL(request.url).pathname;
      return HttpResponse.json(qualityProfileFixtures);
    }));
    // Confirm LidarrClient calls v1 path
    await lidarrClient.getQualityProfiles();
    expect(calledPath).toBe('/api/v1/qualityprofile');
  });
});
