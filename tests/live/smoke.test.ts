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
      const data = await callTool<{ term: string; results: Record<string, unknown> }>('arr_search_all', { term: searchTerm });
      expect(data.term).toBe(searchTerm);
      for (const service of mediaServices) {
        expect(data.results[service]).toBeDefined();
      }
    });
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
    });

    if (enableCommandSmoke) {
      it('safe command tools respond when a test movie is available', async () => {
        const movieId = asOptionalNumber(process.env.RADARR_TEST_MOVIE_ID);
        if (!movieId) return;
        await callTool('radarr_refresh_movie', { movieId });
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
    });

    if (enableCommandSmoke) {
      it('safe command tools respond when a test series is available', async () => {
        const seriesId = asOptionalNumber(process.env.SONARR_TEST_SERIES_ID);
        if (!seriesId) return;
        await callTool('sonarr_refresh_series', { seriesId });
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
  });
}

if (clients.prowlarr) {
  describe('live Prowlarr smoke', () => {
    it('read-only tools respond', async () => {
      await callTool('prowlarr_get_indexers');
      await callTool('prowlarr_search', { query: searchTerm });
      await callTool('prowlarr_get_stats');
      await callTool('prowlarr_get_health');
    });

    if (enableCommandSmoke) {
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
