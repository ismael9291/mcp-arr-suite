import { describe, it, expect } from 'vitest';
import { HandlerRegistry } from '../../src/registry.js';
import type { ClientMap } from '../../src/types.js';
import { SonarrClient, RadarrClient, LidarrClient, ProwlarrClient } from '../../src/clients/arr-client.js';
import { buildConfigModule } from '../../src/shared/config-tools.js';
import { crossServiceModule } from '../../src/services/cross-service.js';
import { sonarrModule } from '../../src/services/sonarr.js';
import { radarrModule } from '../../src/services/radarr.js';
import { lidarrModule } from '../../src/services/lidarr.js';
import { prowlarrModule } from '../../src/services/prowlarr.js';
import { trashModule } from '../../src/trash/tools.js';

const searchTerm = process.env.MCP_ARR_LIVE_SEARCH_TERM ?? 'dune';
const enableTrash = process.env.MCP_ARR_ENABLE_TRASH === '1';
const enableCommandSmoke = process.env.MCP_ARR_ENABLE_COMMAND_SMOKE === '1';

const clients: ClientMap = {};

if (process.env.SONARR_URL && process.env.SONARR_API_KEY) {
  clients.sonarr = new SonarrClient({
    url: process.env.SONARR_URL,
    apiKey: process.env.SONARR_API_KEY,
  });
}
if (process.env.RADARR_URL && process.env.RADARR_API_KEY) {
  clients.radarr = new RadarrClient({
    url: process.env.RADARR_URL,
    apiKey: process.env.RADARR_API_KEY,
  });
}
if (process.env.LIDARR_URL && process.env.LIDARR_API_KEY) {
  clients.lidarr = new LidarrClient({
    url: process.env.LIDARR_URL,
    apiKey: process.env.LIDARR_API_KEY,
  });
}
if (process.env.PROWLARR_URL && process.env.PROWLARR_API_KEY) {
  clients.prowlarr = new ProwlarrClient({
    url: process.env.PROWLARR_URL,
    apiKey: process.env.PROWLARR_API_KEY,
  });
}

const configuredServices = Object.keys(clients) as Array<keyof ClientMap>;
const hasAnyService = configuredServices.length > 0;
const mediaServices = configuredServices.filter((name) => name !== 'prowlarr');

const registry = new HandlerRegistry();
registry.register(crossServiceModule);
registry.register(trashModule);
if (clients.sonarr) {
  registry.register(buildConfigModule('sonarr', 'Sonarr (TV)'));
  registry.register(sonarrModule);
}
if (clients.radarr) {
  registry.register(buildConfigModule('radarr', 'Radarr (Movies)'));
  registry.register(radarrModule);
}
if (clients.lidarr) {
  registry.register(buildConfigModule('lidarr', 'Lidarr (Music)'));
  registry.register(lidarrModule);
}
if (clients.prowlarr) {
  registry.register(prowlarrModule);
}

async function callTool<T = Record<string, unknown>>(
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const result = await registry.dispatch(name, args, clients);
  expect(result.isError, `${name} returned isError: ${result.content[0]?.text ?? 'no response body'}`).not.toBe(true);
  expect(result.content[0]?.type).toBe('text');
  return JSON.parse(result.content[0].text) as T;
}

function asOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const liveDescribe = hasAnyService ? describe : describe.skip;

type PaginatedItems = { items?: Array<Record<string, unknown>> };
type CountedList = { profiles?: Array<{ id: number; name?: string }>; items?: Array<Record<string, unknown>> };

liveDescribe('live smoke tests against configured Arr services', () => {
  it('arr_status reports every configured service as connected', async () => {
    const data = await callTool<Record<string, { configured: boolean; connected: boolean }>>('arr_status');
    expect(configuredServices.length).toBeGreaterThan(0);
    for (const service of configuredServices) {
      expect(data[service]?.configured).toBe(true);
      expect(data[service]?.connected).toBe(true);
    }
  });

  if (mediaServices.length > 0) {
    it('arr_search_all returns a result envelope for media services', async () => {
      const data = await callTool<{ term: string; type: string; results: Record<string, unknown> }>('arr_search_all', { term: searchTerm });
      expect(data.term).toBe(searchTerm);
      expect(data.type).toBe('all');
      for (const service of mediaServices) {
        expect(data.results[service]).toBeDefined();
      }
    });

    if (clients.radarr) {
      it('arr_search_all type: "movies" only returns radarr results', async () => {
        const data = await callTool<{ type: string; results: Record<string, unknown> }>('arr_search_all', { term: searchTerm, type: 'movies' });
        expect(data.type).toBe('movies');
        expect(data.results).toHaveProperty('radarr');
        expect(data.results).not.toHaveProperty('sonarr');
        expect(data.results).not.toHaveProperty('lidarr');
      });
    }

    if (clients.sonarr) {
      it('arr_search_all type: "tv" only returns sonarr results', async () => {
        const data = await callTool<{ type: string; results: Record<string, unknown> }>('arr_search_all', { term: searchTerm, type: 'tv' });
        expect(data.type).toBe('tv');
        expect(data.results).toHaveProperty('sonarr');
        expect(data.results).not.toHaveProperty('radarr');
        expect(data.results).not.toHaveProperty('lidarr');
      });
    }
  }
});

if (clients.radarr) {
  describe('live Radarr smoke', () => {
    it('config and read-only tools respond', async () => {
      const configTools = [
        'radarr_get_quality_profiles',
        'radarr_get_health',
        'radarr_get_root_folders',
        'radarr_get_download_clients',
        'radarr_get_naming',
        'radarr_get_tags',
        'radarr_review_setup',
      ];

      for (const tool of configTools) {
        const data = await callTool(tool);
        expect(data).toBeTruthy();
      }

      const movies = await callTool<PaginatedItems>('radarr_get_movies', { limit: 2 });
      expect(Array.isArray(movies.items)).toBe(true);
      await callTool('radarr_search', { term: searchTerm });
      await callTool('radarr_get_queue', { limit: 3 });
      await callTool('radarr_get_calendar', { days: 7 });
      await callTool('radarr_get_disk_space');
      await callTool('radarr_get_history', { pageSize: 5 });
      await callTool('radarr_get_wanted_missing', { pageSize: 5 });
      await callTool('radarr_get_wanted_cutoff', { pageSize: 5 });
      await callTool('radarr_get_blocklist', { pageSize: 5 });

      const movieId = asOptionalNumber(process.env.RADARR_TEST_MOVIE_ID) ?? movies.items?.[0]?.id as number | undefined;
      if (movieId) {
        await callTool('radarr_get_movie_files', { movieId });
      }

      // New tools: quality profile, custom formats, tags, import exclusions
      const profiles = await callTool<{ profiles: Array<{ id: number; name: string }> }>('radarr_get_quality_profiles');
      const firstProfileId = profiles.profiles?.[0]?.id;
      if (firstProfileId) {
        const profile = await callTool<{ id: number; upgradeAllowed: boolean; customFormats: unknown[] }>('radarr_get_quality_profile', { profileId: firstProfileId });
        expect(profile.id).toBe(firstProfileId);
        expect(typeof profile.upgradeAllowed).toBe('boolean');
        expect(Array.isArray(profile.customFormats)).toBe(true);
      }

      const formats = await callTool<{ count: number; customFormats: unknown[] }>('radarr_list_custom_formats');
      expect(typeof formats.count).toBe('number');
      expect(Array.isArray(formats.customFormats)).toBe(true);

      const exclusions = await callTool<{ count: number; exclusions: unknown[] }>('radarr_get_import_exclusions');
      expect(typeof exclusions.count).toBe('number');
      expect(Array.isArray(exclusions.exclusions)).toBe(true);
    });

    it('radarr_search_releases returns a valid release list for a movie', async () => {
      const movies = await callTool<PaginatedItems>('radarr_get_movies', { limit: 5 });
      const movieId = asOptionalNumber(process.env.RADARR_TEST_MOVIE_ID) ?? movies.items?.[0]?.id as number | undefined;
      if (!movieId) {
        console.log('  [skip] no movie in library — skipping radarr_search_releases');
        return;
      }
      const data = await callTool<{
        count: number;
        releases: Array<{
          guid: string;
          indexerId: number;
          indexer: string;
          title: string;
          size: string;
          sizeBytes: number;
          quality: string;
          customFormatScore: number;
          approved: boolean;
          rejected: boolean;
          rejections: string[];
          protocol: string;
        }>;
      }>('radarr_search_releases', { movieId });

      expect(typeof data.count).toBe('number');
      expect(Array.isArray(data.releases)).toBe(true);

      if (data.releases.length > 0) {
        const r = data.releases[0];
        expect(typeof r.guid).toBe('string');
        expect(typeof r.indexerId).toBe('number');
        expect(typeof r.title).toBe('string');
        expect(typeof r.sizeBytes).toBe('number');
        expect(r.size).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
        expect(typeof r.approved).toBe('boolean');
        expect(typeof r.rejected).toBe('boolean');
        expect(Array.isArray(r.rejections)).toBe(true);
        expect(['usenet', 'torrent'].includes(r.protocol)).toBe(true);
      }
    });

    it('tag create/delete round-trip succeeds', async () => {
      const created = await callTool<{ id: number; label: string }>('radarr_create_tag', { label: 'smoke-test-tag' });
      expect(created.id).toBeGreaterThan(0);
      expect(created.label).toBe('smoke-test-tag');
      await callTool('radarr_delete_tag', { tagId: created.id });
    });

    it('radarr_get_queue includes diagnostic fields', async () => {
      const data = await callTool<{ totalRecords: number; items: Array<Record<string, unknown>> }>('radarr_get_queue', { limit: 5 });
      expect(typeof data.totalRecords).toBe('number');
      if (data.items.length > 0) {
        const item = data.items[0];
        expect(item).toHaveProperty('trackedDownloadStatus');
        expect(item).toHaveProperty('trackedDownloadState');
        expect(item).toHaveProperty('statusMessages');
      }
    });

    it('radarr_get_manual_import responds for a folder', async () => {
      const folder = process.env.RADARR_TEST_IMPORT_FOLDER ?? '/tmp';
      const data = await callTool<{ count: number; items: unknown[] }>('radarr_get_manual_import', { folder, filterExistingFiles: true });
      expect(typeof data.count).toBe('number');
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('radarr_bulk_update_movies with empty list succeeds gracefully', async () => {
      // Using empty list to test the endpoint without touching real data
      const data = await callTool<{ success: boolean; movieIds: number[] }>('radarr_bulk_update_movies', { movieIds: [] });
      expect(data.success).toBe(true);
    });

    if (enableCommandSmoke) {
      it('safe command tools respond when a test movie is available', async () => {
        const movieId = asOptionalNumber(process.env.RADARR_TEST_MOVIE_ID);
        if (!movieId) return;
        await callTool('radarr_refresh_movie', { movieId });
      });

      it('radarr_refresh_movie with no ID triggers all-library refresh', async () => {
        const data = await callTool<{ success: boolean; commandId: number }>('radarr_refresh_movie');
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
        const status = await callTool<{ id: number; status: string }>('radarr_get_command_status', { commandId: data.commandId });
        expect(typeof status.status).toBe('string');
      });

      it('trigger commands respond', async () => {
        await callTool('radarr_trigger_refresh_monitored_downloads');
        await callTool('radarr_trigger_rss_sync');
        // radarr_trigger_cutoff_unmet_search skipped: CutoffUnmetSearch command not available until Radarr v6.1+
      });

      it('radarr_trigger_rescan_movies responds with commandId', async () => {
        const data = await callTool<{ success: boolean; commandId: number }>('radarr_trigger_rescan_movies');
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
      });

      it('radarr_trigger_missing_search responds with commandId', async () => {
        const data = await callTool<{ success: boolean; commandId: number }>('radarr_trigger_missing_search');
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
      });

      it('radarr_trigger_rename_movies responds with commandId', async () => {
        const data = await callTool<{ success: boolean; commandId: number }>('radarr_trigger_rename_movies');
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
      });

      it('radarr_trigger_downloaded_scan responds with commandId', async () => {
        const data = await callTool<{ success: boolean; commandId: number }>('radarr_trigger_downloaded_scan');
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
      });

      it('radarr_get_command_status polls a triggered command', async () => {
        const triggered = await callTool<{ commandId: number }>('radarr_trigger_rss_sync');
        const status = await callTool<{ id: number; name: string; status: string }>('radarr_get_command_status', { commandId: triggered.commandId });
        expect(status.id).toBe(triggered.commandId);
        expect(typeof status.status).toBe('string');
        expect(['queued', 'started', 'completed', 'failed', 'aborted'].includes(status.status)).toBe(true);
      });

      it('radarr_grab_release grabs the first approved release for a test movie', async () => {
        const movieId = asOptionalNumber(process.env.RADARR_TEST_MOVIE_ID);
        if (!movieId) return;
        const search = await callTool<{ count: number; releases: Array<{ guid: string; indexerId: number; approved: boolean }> }>('radarr_search_releases', { movieId });
        const approved = search.releases.find(r => r.approved);
        if (!approved) {
          console.log('  [skip] no approved release found — skipping radarr_grab_release');
          return;
        }
        const grabbed = await callTool<{ success: boolean; title: string }>('radarr_grab_release', { guid: approved.guid, indexerId: approved.indexerId });
        expect(grabbed.success).toBe(true);
        expect(typeof grabbed.title).toBe('string');
      });
    }
  });
}

if (clients.sonarr) {
  describe('live Sonarr smoke', () => {
    it('config and read-only tools respond', async () => {
      const configTools = [
        'sonarr_get_quality_profiles',
        'sonarr_get_health',
        'sonarr_get_root_folders',
        'sonarr_get_download_clients',
        'sonarr_get_naming',
        'sonarr_get_tags',
        'sonarr_review_setup',
      ];

      for (const tool of configTools) {
        const data = await callTool(tool);
        expect(data).toBeTruthy();
      }

      const series = await callTool<PaginatedItems>('sonarr_get_series', { limit: 2 });
      expect(Array.isArray(series.items)).toBe(true);
      await callTool('sonarr_search', { term: searchTerm });
      await callTool('sonarr_get_queue', { limit: 3 });
      await callTool('sonarr_get_calendar', { days: 7 });
      await callTool('sonarr_get_disk_space');
      await callTool('sonarr_get_history', { pageSize: 5 });
      await callTool('sonarr_get_wanted_missing', { pageSize: 5 });
      await callTool('sonarr_get_wanted_cutoff', { pageSize: 5 });
      await callTool('sonarr_get_blocklist', { pageSize: 5 });

      const seriesId = asOptionalNumber(process.env.SONARR_TEST_SERIES_ID) ?? series.items?.[0]?.id as number | undefined;
      if (seriesId) {
        await callTool('sonarr_get_episodes', { seriesId });
        await callTool('sonarr_get_episode_files', { seriesId });
      }

      // New tools: quality profile, custom formats, tags, import exclusions
      const profiles = await callTool<{ profiles: Array<{ id: number; name: string }> }>('sonarr_get_quality_profiles');
      const firstProfileId = profiles.profiles?.[0]?.id;
      if (firstProfileId) {
        const profile = await callTool<{ id: number; upgradeAllowed: boolean; customFormats: unknown[] }>('sonarr_get_quality_profile', { profileId: firstProfileId });
        expect(profile.id).toBe(firstProfileId);
        expect(typeof profile.upgradeAllowed).toBe('boolean');
        expect(Array.isArray(profile.customFormats)).toBe(true);
      }

      const formats = await callTool<{ count: number; customFormats: unknown[] }>('sonarr_list_custom_formats');
      expect(typeof formats.count).toBe('number');
      expect(Array.isArray(formats.customFormats)).toBe(true);

      const exclusions = await callTool<{ count: number; exclusions: unknown[] }>('sonarr_get_import_exclusions');
      expect(typeof exclusions.count).toBe('number');
      expect(Array.isArray(exclusions.exclusions)).toBe(true);
    });

    it('sonarr_search_releases returns a valid release list for an episode', async () => {
      const series = await callTool<PaginatedItems>('sonarr_get_series', { limit: 5 });
      const seriesId = asOptionalNumber(process.env.SONARR_TEST_SERIES_ID) ?? series.items?.[0]?.id as number | undefined;
      if (!seriesId) {
        console.log('  [skip] no series in library — skipping sonarr_search_releases');
        return;
      }

      const episodeIdFromEnv = asOptionalNumber(process.env.SONARR_TEST_EPISODE_ID);
      let episodeId = episodeIdFromEnv;

      if (!episodeId) {
        const episodes = await callTool<{ count: number; episodes: Array<{ id: number }> }>('sonarr_get_episodes', { seriesId });
        episodeId = episodes.episodes?.[0]?.id;
      }

      if (!episodeId) {
        console.log('  [skip] no episodes found — skipping sonarr_search_releases');
        return;
      }

      const data = await callTool<{
        count: number;
        releases: Array<{
          guid: string;
          indexerId: number;
          indexer: string;
          title: string;
          size: string;
          sizeBytes: number;
          quality: string;
          customFormatScore: number;
          approved: boolean;
          rejected: boolean;
          rejections: string[];
          protocol: string;
        }>;
      }>('sonarr_search_releases', { episodeId });

      expect(typeof data.count).toBe('number');
      expect(Array.isArray(data.releases)).toBe(true);

      if (data.releases.length > 0) {
        const r = data.releases[0];
        expect(typeof r.guid).toBe('string');
        expect(typeof r.indexerId).toBe('number');
        expect(typeof r.title).toBe('string');
        expect(typeof r.sizeBytes).toBe('number');
        expect(r.size).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
        expect(typeof r.approved).toBe('boolean');
        expect(typeof r.rejected).toBe('boolean');
        expect(Array.isArray(r.rejections)).toBe(true);
        expect(['usenet', 'torrent'].includes(r.protocol)).toBe(true);
      }
    });

    it('tag create/delete round-trip succeeds', async () => {
      const created = await callTool<{ id: number; label: string }>('sonarr_create_tag', { label: 'smoke-test-tag' });
      expect(created.id).toBeGreaterThan(0);
      expect(created.label).toBe('smoke-test-tag');
      await callTool('sonarr_delete_tag', { tagId: created.id });
    });

    it('sonarr_get_queue includes diagnostic fields', async () => {
      const data = await callTool<{ totalRecords: number; items: Array<Record<string, unknown>> }>('sonarr_get_queue', { limit: 5 });
      expect(typeof data.totalRecords).toBe('number');
      if (data.items.length > 0) {
        const item = data.items[0];
        expect(item).toHaveProperty('trackedDownloadStatus');
        expect(item).toHaveProperty('trackedDownloadState');
        expect(item).toHaveProperty('statusMessages');
      }
    });

    it('sonarr_get_manual_import responds for a folder', async () => {
      const folder = process.env.SONARR_TEST_IMPORT_FOLDER ?? '/tmp';
      const data = await callTool<{ count: number; items: unknown[] }>('sonarr_get_manual_import', { folder, filterExistingFiles: true });
      expect(typeof data.count).toBe('number');
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('sonarr_bulk_update_series with empty list succeeds gracefully', async () => {
      const data = await callTool<{ success: boolean; seriesIds: number[] }>('sonarr_bulk_update_series', { seriesIds: [] });
      expect(data.success).toBe(true);
    });

    if (enableCommandSmoke) {
      it('safe command tools respond when a test series is available', async () => {
        const seriesId = asOptionalNumber(process.env.SONARR_TEST_SERIES_ID);
        if (!seriesId) return;
        await callTool('sonarr_refresh_series', { seriesId });
      });

      it('sonarr_refresh_series with no ID triggers all-library refresh', async () => {
        const data = await callTool<{ success: boolean; commandId: number }>('sonarr_refresh_series');
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
        const status = await callTool<{ id: number; status: string }>('sonarr_get_command_status', { commandId: data.commandId });
        expect(typeof status.status).toBe('string');
      });

      it('trigger commands respond', async () => {
        await callTool('sonarr_trigger_refresh_monitored_downloads');
        await callTool('sonarr_trigger_rss_sync');
        await callTool('sonarr_trigger_cutoff_unmet_search');
      });

      it('sonarr_trigger_rescan_series responds with commandId', async () => {
        const data = await callTool<{ success: boolean; commandId: number }>('sonarr_trigger_rescan_series');
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
      });

      it('sonarr_trigger_rename_series responds with commandId', async () => {
        const data = await callTool<{ success: boolean; commandId: number }>('sonarr_trigger_rename_series');
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
      });

      it('sonarr_trigger_downloaded_scan responds with commandId', async () => {
        const data = await callTool<{ success: boolean; commandId: number }>('sonarr_trigger_downloaded_scan');
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
      });

      it('sonarr_get_command_status polls a triggered command', async () => {
        const triggered = await callTool<{ commandId: number }>('sonarr_trigger_rss_sync');
        const status = await callTool<{ id: number; name: string; status: string }>('sonarr_get_command_status', { commandId: triggered.commandId });
        expect(status.id).toBe(triggered.commandId);
        expect(typeof status.status).toBe('string');
        expect(['queued', 'started', 'completed', 'failed', 'aborted'].includes(status.status)).toBe(true);
      });

      it('sonarr_grab_release grabs the first approved release for a test episode', async () => {
        const episodeId = asOptionalNumber(process.env.SONARR_TEST_EPISODE_ID);
        if (!episodeId) return;
        const search = await callTool<{ count: number; releases: Array<{ guid: string; indexerId: number; approved: boolean }> }>('sonarr_search_releases', { episodeId });
        const approved = search.releases.find(r => r.approved);
        if (!approved) {
          console.log('  [skip] no approved release found — skipping sonarr_grab_release');
          return;
        }
        const grabbed = await callTool<{ success: boolean; title: string }>('sonarr_grab_release', { guid: approved.guid, indexerId: approved.indexerId });
        expect(grabbed.success).toBe(true);
        expect(typeof grabbed.title).toBe('string');
      });
    }
  });
}

if (clients.lidarr) {
  describe('live Lidarr smoke', () => {
    it('config and read-only tools respond', async () => {
      const configTools = [
        'lidarr_get_quality_profiles',
        'lidarr_get_health',
        'lidarr_get_root_folders',
        'lidarr_get_download_clients',
        'lidarr_get_naming',
        'lidarr_get_tags',
        'lidarr_review_setup',
      ];

      for (const tool of configTools) {
        const data = await callTool(tool);
        expect(data).toBeTruthy();
      }

      const artists = await callTool<PaginatedItems>('lidarr_get_artists', { limit: 2 });
      expect(Array.isArray(artists.items)).toBe(true);
      await callTool('lidarr_search', { term: searchTerm });
      await callTool('lidarr_get_queue', { limit: 3 });
      await callTool('lidarr_get_calendar', { days: 30 });
      await callTool('lidarr_get_metadata_profiles');

      const artistId = asOptionalNumber(process.env.LIDARR_TEST_ARTIST_ID) ?? artists.items?.[0]?.id as number | undefined;
      if (artistId) {
        await callTool('lidarr_get_albums', { artistId });
      }
    });

    it('new read-only tools respond', async () => {
      await callTool('lidarr_get_disk_space');
      await callTool('lidarr_get_history', { pageSize: 5 });
      await callTool('lidarr_get_wanted_missing', { pageSize: 5 });
      await callTool('lidarr_get_wanted_cutoff', { pageSize: 5 });
      await callTool('lidarr_get_blocklist', { pageSize: 5 });
    });

    it('lidarr_get_queue includes diagnostic fields', async () => {
      const data = await callTool<{ totalRecords: number; items: Array<Record<string, unknown>> }>('lidarr_get_queue', { limit: 5 });
      expect(typeof data.totalRecords).toBe('number');
      if (data.items.length > 0) {
        const item = data.items[0];
        expect(item).toHaveProperty('trackedDownloadStatus');
        expect(item).toHaveProperty('trackedDownloadState');
        expect(item).toHaveProperty('statusMessages');
      }
    });

    it('gap #3-5 parity tools respond', async () => {
      await callTool('lidarr_get_system_tasks');
      await callTool('lidarr_get_logs', { pageSize: 5 });
      await callTool('lidarr_get_notifications');
      await callTool('lidarr_list_custom_formats');
      await callTool('lidarr_get_import_lists');
      await callTool('lidarr_get_import_exclusions');
    });

    it('lidarr tag create/delete round-trip succeeds', async () => {
      const created = await callTool<{ success: boolean; id: number }>('lidarr_create_tag', { label: 'smoke-test-tag' });
      expect(created.success).toBe(true);
      expect(created.id).toBeGreaterThan(0);
      await callTool('lidarr_delete_tag', { tagId: created.id });
    });

    it('lidarr_get_disk_space returns formatted disk info', async () => {
      const data = await callTool<{ count: number; disks: Array<{ path: string; freeSpace: string; totalSpace: string; freePercent: string }> }>('lidarr_get_disk_space');
      expect(typeof data.count).toBe('number');
      expect(Array.isArray(data.disks)).toBe(true);
      if (data.disks.length > 0) {
        expect(data.disks[0].freeSpace).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
        expect(data.disks[0].totalSpace).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
        expect(data.disks[0].freePercent).toMatch(/\d+\.\d+%/);
      }
    });

    it('lidarr_get_track_files and lidarr_get_history respond for a test artist', async () => {
      const artists = await callTool<PaginatedItems>('lidarr_get_artists', { limit: 5 });
      const artistId = asOptionalNumber(process.env.LIDARR_TEST_ARTIST_ID) ?? artists.items?.[0]?.id as number | undefined;
      if (!artistId) {
        console.log('  [skip] no artist in library — skipping artist-specific tools');
        return;
      }
      const files = await callTool<{ count: number; files: Array<Record<string, unknown>> }>('lidarr_get_track_files', { artistId });
      expect(typeof files.count).toBe('number');
      expect(Array.isArray(files.files)).toBe(true);

      const history = await callTool<{ totalRecords: number; records: unknown[] }>('lidarr_get_history', { artistId, pageSize: 5 });
      expect(typeof history.totalRecords).toBe('number');
      expect(Array.isArray(history.records)).toBe(true);
    });

    it('new gap-closure tools respond', async () => {
      // lidarr_get_quality_profile / lidarr_update_quality_profile
      const profiles = await callTool<{ profiles: Array<{ id: number; name: string }> }>('lidarr_get_quality_profiles');
      const profileId = profiles.profiles?.[0]?.id;
      if (profileId !== undefined) {
        const profile = await callTool<{ id: number; name: string; qualities: string[] }>('lidarr_get_quality_profile', { profileId });
        expect(profile.id).toBe(profileId);
        expect(Array.isArray(profile.qualities)).toBe(true);
      }

      // lidarr_get_album_by_id
      const artists = await callTool<PaginatedItems>('lidarr_get_artists', { limit: 3 });
      const artistId = asOptionalNumber(process.env.LIDARR_TEST_ARTIST_ID) ?? artists.items?.[0]?.id as number | undefined;
      if (artistId) {
        const albums = await callTool<{ count: number; albums: Array<{ id: number }> }>('lidarr_get_albums', { artistId });
        const albumId = albums.albums?.[0]?.id;
        if (albumId !== undefined) {
          const album = await callTool<{ id: number; title: string; tracks: string }>('lidarr_get_album_by_id', { albumId });
          expect(album.id).toBe(albumId);
          expect(typeof album.title).toBe('string');
          expect(typeof album.tracks).toBe('string');

          // lidarr_get_track_files with albumId filter
          const filtered = await callTool<{ count: number; files: Array<Record<string, unknown>> }>('lidarr_get_track_files', { artistId, albumId });
          expect(typeof filtered.count).toBe('number');
        }
      }
    });

    if (enableCommandSmoke) {
      it('lidarr trigger commands respond with commandId', async () => {
        const backup = await callTool<{ success: boolean; commandId: number }>('lidarr_trigger_backup');
        expect(backup.success).toBe(true);
        expect(typeof backup.commandId).toBe('number');

        await callTool('lidarr_trigger_rss_sync');
        await callTool('lidarr_trigger_refresh_monitored_downloads');

        // RescanArtists / RenameArtist may not be supported on all Lidarr versions — skip gracefully
        for (const tool of ['lidarr_trigger_rescan_artists', 'lidarr_trigger_rename_artists', 'lidarr_trigger_downloaded_scan'] as const) {
          try {
            const result = await callTool<{ success: boolean; commandId: number }>(tool);
            expect(result.success).toBe(true);
          } catch (e) {
            console.log(`  [skip] ${tool} not supported on this Lidarr instance: ${(e as Error).message.slice(0, 80)}`);
          }
        }

        const refresh = await callTool<{ success: boolean; commandId: number }>('lidarr_trigger_refresh_all_artists');
        expect(refresh.success).toBe(true);
      });

      it('lidarr_get_command_status polls a triggered command', async () => {
        const triggered = await callTool<{ commandId: number }>('lidarr_trigger_rss_sync');
        const status = await callTool<{ id: number; name: string; status: string }>('lidarr_get_command_status', { commandId: triggered.commandId });
        expect(typeof status.status).toBe('string');
        expect(['queued', 'started', 'completed', 'failed', 'aborted'].includes(status.status)).toBe(true);
      });

      it('lidarr_refresh_artist responds for a test artist', async () => {
        const artists = await callTool<PaginatedItems>('lidarr_get_artists', { limit: 5 });
        const artistId = asOptionalNumber(process.env.LIDARR_TEST_ARTIST_ID) ?? artists.items?.[0]?.id as number | undefined;
        if (!artistId) return;
        const data = await callTool<{ success: boolean; commandId: number }>('lidarr_refresh_artist', { artistId });
        expect(data.success).toBe(true);
        expect(typeof data.commandId).toBe('number');
      });

      it('lidarr_monitor_albums round-trip succeeds', async () => {
        const artists = await callTool<PaginatedItems>('lidarr_get_artists', { limit: 5 });
        const artistId = asOptionalNumber(process.env.LIDARR_TEST_ARTIST_ID) ?? artists.items?.[0]?.id as number | undefined;
        if (!artistId) return;
        const albums = await callTool<{ count: number; albums: Array<{ id: number; monitored: boolean }> }>('lidarr_get_albums', { artistId });
        const album = albums.albums?.[0];
        if (!album) {
          console.log('  [skip] no albums for artist — skipping lidarr_monitor_albums');
          return;
        }
        // Toggle monitored off then back to original state
        await callTool('lidarr_monitor_albums', { albumIds: [album.id], monitored: !album.monitored });
        await callTool('lidarr_monitor_albums', { albumIds: [album.id], monitored: album.monitored });
      });
    }
  });
}

if (clients.prowlarr) {
  describe('live Prowlarr smoke', () => {
    it('read-only tools respond', async () => {
      await callTool('prowlarr_get_indexers');
      await callTool('prowlarr_get_health');
      await callTool('prowlarr_get_stats');
      await callTool('prowlarr_get_tags');
      await callTool('prowlarr_get_download_clients');
      await callTool('prowlarr_get_apps');
      await callTool('prowlarr_get_history');
    });

    it('prowlarr tag create/delete round-trip succeeds', async () => {
      const created = await callTool<{ success: boolean; id: number; message: string }>('prowlarr_create_tag', { label: 'smoke-test-prowlarr' });
      expect(created.success).toBe(true);
      expect(created.id).toBeGreaterThan(0);
      await callTool('prowlarr_delete_tag', { tagId: created.id });
    });

    it('search with default pagination responds', async () => {
      const data = await callTool<{ totalResults: number; returned: number; offset: number; limit: number; hasMore: boolean; results: unknown[] }>('prowlarr_search', { term: searchTerm });
      expect(data.offset).toBe(0);
      expect(data.limit).toBe(25);
      expect(typeof data.totalResults).toBe('number');
      expect(typeof data.returned).toBe('number');
      expect(typeof data.hasMore).toBe('boolean');
      expect(data.returned).toBeLessThanOrEqual(data.limit);
      expect(Array.isArray(data.results)).toBe(true);
    });

    it('search with category filter responds', async () => {
      // 2000 = Movies category in Newznab
      const data = await callTool<{ totalResults: number; returned: number; results: unknown[] }>('prowlarr_search', { term: searchTerm, categories: [2000] });
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.returned).toBeLessThanOrEqual(25);
    });

    it('search with explicit pagination responds', async () => {
      const data = await callTool<{ totalResults: number; returned: number; offset: number; limit: number; hasMore: boolean }>('prowlarr_search', { term: searchTerm, offset: 0, limit: 10 });
      expect(data.offset).toBe(0);
      expect(data.limit).toBe(10);
      expect(data.returned).toBeLessThanOrEqual(10);
      expect(typeof data.hasMore).toBe('boolean');
    });

    it('new gap-closure tools respond', async () => {
      await callTool('prowlarr_get_logs', { pageSize: 5 });
      await callTool('prowlarr_get_system_tasks');
      await callTool('prowlarr_get_notifications');
    });

    if (enableCommandSmoke) {
      it('prowlarr_trigger_backup responds with commandId', async () => {
        const result = await callTool<{ success: boolean; commandId: number }>('prowlarr_trigger_backup');
        expect(result.success).toBe(true);
        expect(typeof result.commandId).toBe('number');
      });

      it('prowlarr_get_command_status polls a triggered command', async () => {
        const triggered = await callTool<{ commandId: number }>('prowlarr_trigger_backup');
        const status = await callTool<{ id: number; status: string }>('prowlarr_get_command_status', { commandId: triggered.commandId });
        expect(typeof status.status).toBe('string');
        expect(['queued', 'started', 'completed', 'failed', 'aborted'].includes(status.status)).toBe(true);
      });

      it('indexer test command responds', async () => {
        await callTool('prowlarr_test_indexers');
      });
    }
  });
}

if (enableTrash) {
  describe('live TRaSH Guides smoke', () => {
    const trashServices = (['radarr', 'sonarr'] as const).filter((service) => clients[service]);

    for (const service of trashServices) {
      it(`TRaSH read-only tools respond for ${service}`, async () => {
        const profiles = await callTool<{ profiles: Array<{ name: string }> }>('trash_list_profiles', { service });
        expect(Array.isArray(profiles.profiles)).toBe(true);

        const firstProfile = profiles.profiles[0]?.name;
        if (firstProfile) {
          await callTool('trash_get_profile', { service, profile: firstProfile });
        }

        await callTool('trash_list_custom_formats', { service });
        await callTool('trash_get_naming', { service, mediaServer: 'plex' });
        await callTool('trash_get_quality_sizes', {
          service,
          type: service === 'radarr' ? 'movie' : 'series',
        });

        const localProfiles = await callTool<CountedList>(`${service}_get_quality_profiles`);
        const profileId = localProfiles.profiles?.[0]?.id;
        if (profileId && firstProfile) {
          await callTool('trash_compare_profile', { service, profileId, trashProfile: firstProfile });
        }
        await callTool('trash_compare_naming', { service, mediaServer: 'plex' });
      });
    }
  });
}
