/**
 * Lidarr (Music) ToolModule
 */

import type { ToolModule } from '../types.js';
import { ok } from '../types.js';
import { formatBytes, truncate, paginate, clampLimit, clampOffset, today, daysFromNow } from '../shared/formatting.js';

export const lidarrModule: ToolModule = {
  tools: [
    {
      name: 'lidarr_get_artists',
      description:
        'Get artists from the Lidarr library. Returns summary fields only. Default limit=25 to keep context usage low.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number', description: 'Results per page (default: 25, max: 100)' },
          offset: { type: 'number', description: 'Skip N results (default: 0)' },
          search: { type: 'string', description: 'Case-insensitive name filter' },
        },
        required: [],
      },
    },
    {
      name: 'lidarr_search',
      description:
        'Search for artists by name. Returns top 10 results with foreignArtistId needed for lidarr_add_artist.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          term: { type: 'string', description: 'Artist name to search for' },
        },
        required: ['term'],
      },
    },
    {
      name: 'lidarr_get_queue',
      description: 'Get current Lidarr download queue. Shows active downloads and their progress.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number', description: 'Max queue items to return (default: 10)' },
        },
        required: [],
      },
    },
    {
      name: 'lidarr_get_albums',
      description:
        'Get albums for an artist. Shows which albums are available and which are missing.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          artistId: { type: 'number', description: 'Artist ID (from lidarr_get_artists)' },
        },
        required: ['artistId'],
      },
    },
    {
      name: 'lidarr_search_album',
      description: 'Trigger a download search for a specific album.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          albumId: { type: 'number', description: 'Album ID (from lidarr_get_albums)' },
        },
        required: ['albumId'],
      },
    },
    {
      name: 'lidarr_search_missing',
      description: 'Trigger a search for all missing albums for an artist.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          artistId: { type: 'number', description: 'Artist ID (from lidarr_get_artists)' },
        },
        required: ['artistId'],
      },
    },
    {
      name: 'lidarr_get_calendar',
      description: 'Get upcoming album releases from Lidarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          days: { type: 'number', description: 'Days to look ahead (default: 30)' },
        },
        required: [],
      },
    },
    {
      name: 'lidarr_get_metadata_profiles',
      description:
        'Get available metadata profiles for Lidarr. Use this to find valid metadataProfileId values when adding an artist.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'lidarr_add_artist',
      description:
        'Add an artist to Lidarr. Use lidarr_search for foreignArtistId, lidarr_get_root_folders for rootFolderPath, lidarr_get_quality_profiles for qualityProfileId, lidarr_get_metadata_profiles for metadataProfileId, and lidarr_get_tags for tag IDs.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          foreignArtistId: {
            type: 'string',
            description: 'MusicBrainz artist ID from lidarr_search results',
          },
          artistName: { type: 'string', description: 'Artist name' },
          qualityProfileId: { type: 'number', description: 'Quality profile ID' },
          metadataProfileId: { type: 'number', description: 'Metadata profile ID' },
          rootFolderPath: { type: 'string', description: 'Root folder path' },
          monitored: { type: 'boolean', description: 'Monitor the artist (default: true)' },
          tags: {
            type: 'array',
            items: { type: 'number' },
            description: 'Tag IDs (optional)',
          },
        },
        required: ['foreignArtistId', 'artistName', 'qualityProfileId', 'metadataProfileId', 'rootFolderPath'],
      },
    },
  ],

  handlers: {
    lidarr_get_artists: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const limit = clampLimit((args.limit as number | undefined) ?? 25);
      const offset = clampOffset((args.offset as number | undefined) ?? 0);
      const search = (args.search as string | undefined)?.trim().toLowerCase();

      const all = await clients.lidarr.getArtists();
      const filtered = search
        ? all.filter(a => a.artistName.toLowerCase().includes(search))
        : all;
      const page = filtered.slice(offset, offset + limit);

      return ok({
        ...paginate(
          page.map(a => ({
            id: a.id,
            artistName: a.artistName,
            status: a.status,
            albums: a.statistics?.albumCount,
            tracks: `${a.statistics?.trackFileCount ?? 0}/${a.statistics?.totalTrackCount ?? 0}`,
            sizeOnDisk: formatBytes(a.statistics?.sizeOnDisk ?? 0),
            monitored: a.monitored,
            qualityProfileId: a.qualityProfileId,
          })),
          filtered.length,
          offset,
          limit
        ),
        ...(search ? { search } : {}),
        totalLibrary: all.length,
      });
    },

    lidarr_search: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const term = args.term as string;
      const results = await clients.lidarr.searchArtists(term);
      return ok({
        count: results.length,
        results: results.slice(0, 10).map(r => ({
          artistName: r.artistName ?? r.title,
          disambiguation: r.disambiguation,
          foreignArtistId: r.foreignArtistId,
          overview: truncate(r.overview, 200),
        })),
      });
    },

    lidarr_get_queue: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const limit = clampLimit((args.limit as number | undefined) ?? 10);
      const queue = await clients.lidarr.getQueue();
      const items = queue.records.slice(0, limit);
      return ok({
        totalRecords: queue.totalRecords,
        returned: items.length,
        items: items.map(q => ({
          title: q.title,
          status: q.status,
          progress: q.size > 0 ? `${((1 - q.sizeleft / q.size) * 100).toFixed(1)}%` : '0%',
          timeLeft: q.timeleft,
          downloadClient: q.downloadClient,
        })),
      });
    },

    lidarr_get_albums: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const artistId = args.artistId as number;
      const albums = await clients.lidarr.getAlbums(artistId);
      return ok({
        count: albums.length,
        albums: albums.map(a => ({
          id: a.id,
          title: a.title,
          releaseDate: a.releaseDate,
          albumType: a.albumType,
          monitored: a.monitored,
          tracks: a.statistics
            ? `${a.statistics.trackFileCount}/${a.statistics.totalTrackCount}`
            : 'unknown',
          sizeOnDisk: formatBytes(a.statistics?.sizeOnDisk ?? 0),
          percentComplete: a.statistics?.percentOfTracks ?? 0,
          grabbed: a.grabbed,
        })),
      });
    },

    lidarr_search_album: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const albumId = args.albumId as number;
      const result = await clients.lidarr.searchAlbum(albumId);
      return ok({ success: true, message: 'Search triggered for album', commandId: result.id });
    },

    lidarr_search_missing: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const artistId = args.artistId as number;
      const result = await clients.lidarr.searchMissingAlbums(artistId);
      return ok({ success: true, message: 'Search triggered for missing albums', commandId: result.id });
    },

    lidarr_get_calendar: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const days = (args.days as number | undefined) ?? 30;
      const calendar = await clients.lidarr.getCalendar(today(), daysFromNow(days));
      return ok({
        days,
        count: calendar.length,
        albums: calendar.map(a => ({
          id: a.id,
          title: a.title,
          artistId: a.artistId,
          releaseDate: a.releaseDate,
          albumType: a.albumType,
          monitored: a.monitored,
        })),
      });
    },

    lidarr_get_metadata_profiles: async (_args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const profiles = await clients.lidarr.getMetadataProfiles();
      return ok({
        count: profiles.length,
        profiles: profiles.map(p => ({ id: p.id, name: p.name })),
      });
    },

    lidarr_add_artist: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const {
        foreignArtistId,
        artistName,
        qualityProfileId,
        metadataProfileId,
        rootFolderPath,
        monitored,
        tags,
      } = args as {
        foreignArtistId: string;
        artistName: string;
        qualityProfileId: number;
        metadataProfileId: number;
        rootFolderPath: string;
        monitored?: boolean;
        tags?: number[];
      };
      const added = await clients.lidarr.addArtist({
        foreignArtistId,
        artistName,
        qualityProfileId,
        metadataProfileId,
        rootFolderPath,
        monitored,
        tags: tags ?? [],
      });
      return ok({
        success: true,
        message: `Added "${added.artistName}" to Lidarr`,
        id: added.id,
        path: added.path,
        monitored: added.monitored,
      });
    },
  },
};
