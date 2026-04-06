/**
 * Lidarr (Music) ToolModule
 */

import type { ToolModule } from '../types.js';
import { ok } from '../types.js';
import { formatBytes, truncate, paginate, clampLimit, clampOffset, today, daysFromNow } from '../shared/formatting.js';
import type { Artist } from '../clients/arr-client.js';

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
    {
      name: 'lidarr_delete_artist',
      description: 'Delete an artist from Lidarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          artistId: { type: 'number', description: 'Artist ID (from lidarr_get_artists)' },
          deleteFiles: { type: 'boolean', description: 'Delete track files from disk (default: false)' },
          addImportListExclusion: { type: 'boolean', description: 'Add to import list exclusions (default: false)' },
        },
        required: ['artistId'],
      },
    },
    {
      name: 'lidarr_update_artist',
      description: 'Update an artist in Lidarr (monitored state, quality profile, metadata profile, tags).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          artistId: { type: 'number', description: 'Artist ID (from lidarr_get_artists)' },
          monitored: { type: 'boolean', description: 'Monitor the artist' },
          qualityProfileId: { type: 'number', description: 'Quality profile ID' },
          metadataProfileId: { type: 'number', description: 'Metadata profile ID' },
          tags: { type: 'array', items: { type: 'number' }, description: 'Tag IDs' },
        },
        required: ['artistId'],
      },
    },
    {
      name: 'lidarr_remove_from_queue',
      description: 'Remove one or more items from the Lidarr download queue.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ids: { type: 'array', items: { type: 'number' }, description: 'Queue item IDs to remove' },
          blocklist: { type: 'boolean', description: 'Add to blocklist (default: false)' },
          removeFromClient: { type: 'boolean', description: 'Remove from download client (default: true)' },
        },
        required: ['ids'],
      },
    },
    {
      name: 'lidarr_get_blocklist',
      description: 'Get the Lidarr blocklist (previously failed downloads).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Items per page (default: 20)' },
        },
        required: [],
      },
    },
    {
      name: 'lidarr_delete_from_blocklist',
      description: 'Delete a single entry from the Lidarr blocklist.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          blocklistId: { type: 'number', description: 'Blocklist entry ID (from lidarr_get_blocklist)' },
        },
        required: ['blocklistId'],
      },
    },
    {
      name: 'lidarr_get_wanted_missing',
      description: 'Get monitored albums that are missing from Lidarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Items per page (default: 20)' },
        },
        required: [],
      },
    },
    {
      name: 'lidarr_get_wanted_cutoff',
      description: 'Get albums that do not meet their quality cutoff in Lidarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Items per page (default: 20)' },
        },
        required: [],
      },
    },
    {
      name: 'lidarr_get_disk_space',
      description: 'Get disk space usage for Lidarr root folders.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'lidarr_get_track_files',
      description: 'Get track files for an artist in Lidarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          artistId: { type: 'number', description: 'Artist ID (from lidarr_get_artists)' },
        },
        required: ['artistId'],
      },
    },
    {
      name: 'lidarr_delete_track_file',
      description: 'Delete a track file from disk in Lidarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          fileId: { type: 'number', description: 'Track file ID (from lidarr_get_track_files)' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'lidarr_refresh_artist',
      description: 'Trigger a metadata refresh for an artist in Lidarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          artistId: { type: 'number', description: 'Artist ID (from lidarr_get_artists)' },
        },
        required: ['artistId'],
      },
    },
    {
      name: 'lidarr_get_history',
      description: 'Get download history from Lidarr, optionally filtered by artist.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          artistId: { type: 'number', description: 'Filter by artist ID (optional)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Items per page (default: 20)' },
        },
        required: [],
      },
    },
    {
      name: 'lidarr_monitor_albums',
      description: 'Set the monitored state for one or more albums in Lidarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          albumIds: { type: 'array', items: { type: 'number' }, description: 'Album IDs to update' },
          monitored: { type: 'boolean', description: 'Whether to monitor the albums' },
        },
        required: ['albumIds', 'monitored'],
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

    lidarr_delete_artist: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const artistId = args.artistId as number;
      const deleteFiles = (args.deleteFiles as boolean | undefined) ?? false;
      const addImportListExclusion = (args.addImportListExclusion as boolean | undefined) ?? false;
      const artist = await clients.lidarr.getArtistById(artistId);
      await clients.lidarr.deleteArtist(artistId, deleteFiles, addImportListExclusion);
      return ok({
        success: true,
        message: `Deleted "${artist.artistName}" from Lidarr`,
        deletedFiles: deleteFiles,
        addedToExclusions: addImportListExclusion,
      });
    },

    lidarr_update_artist: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const artistId = args.artistId as number;
      const changes: Partial<Artist> = {};
      if (args.monitored !== undefined) changes.monitored = args.monitored as boolean;
      if (args.qualityProfileId !== undefined) changes.qualityProfileId = args.qualityProfileId as number;
      if (args.metadataProfileId !== undefined) changes.metadataProfileId = args.metadataProfileId as number;
      if (args.tags !== undefined) changes.tags = args.tags as number[];
      const updated = await clients.lidarr.updateArtist(artistId, changes);
      return ok({
        success: true,
        id: updated.id,
        artistName: updated.artistName,
        monitored: updated.monitored,
        qualityProfileId: updated.qualityProfileId,
        metadataProfileId: updated.metadataProfileId,
        tags: updated.tags,
      });
    },

    lidarr_remove_from_queue: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const ids = args.ids as number[];
      const blocklist = (args.blocklist as boolean | undefined) ?? false;
      const removeFromClient = (args.removeFromClient as boolean | undefined) ?? true;
      if (ids.length === 1) {
        await clients.lidarr.removeFromQueue(ids[0], blocklist, removeFromClient);
      } else {
        await clients.lidarr.removeFromQueueBulk(ids, blocklist, removeFromClient);
      }
      return ok({
        success: true,
        message: `Removed ${ids.length} item(s) from queue`,
        ids,
        blocklisted: blocklist,
        removedFromClient: removeFromClient,
      });
    },

    lidarr_get_blocklist: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = (args.pageSize as number | undefined) ?? 20;
      const result = await clients.lidarr.getBlocklist(page, pageSize);
      return ok({
        totalRecords: result.totalRecords,
        returned: result.records.length,
        entries: result.records.map(r => ({
          id: r.id,
          artistId: r.artistId,
          sourceTitle: r.sourceTitle,
          quality: r.quality?.quality?.name,
          date: r.date,
          protocol: r.protocol,
          indexer: r.indexer,
          message: r.message,
        })),
      });
    },

    lidarr_delete_from_blocklist: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const blocklistId = args.blocklistId as number;
      await clients.lidarr.deleteFromBlocklist(blocklistId);
      return ok({ success: true, message: `Deleted blocklist entry ${blocklistId}` });
    },

    lidarr_get_wanted_missing: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = (args.pageSize as number | undefined) ?? 20;
      const result = await clients.lidarr.getWantedMissing(page, pageSize);
      return ok({
        totalRecords: result.totalRecords,
        page: result.page,
        pageSize: result.pageSize,
        returned: result.records.length,
        hasMore: result.page * result.pageSize < result.totalRecords,
        albums: result.records.map(a => ({
          id: a.id,
          title: a.title,
          artistId: a.artistId,
          monitored: a.monitored,
          releaseDate: a.releaseDate,
        })),
      });
    },

    lidarr_get_wanted_cutoff: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = (args.pageSize as number | undefined) ?? 20;
      const result = await clients.lidarr.getWantedCutoff(page, pageSize);
      return ok({
        totalRecords: result.totalRecords,
        page: result.page,
        pageSize: result.pageSize,
        returned: result.records.length,
        hasMore: result.page * result.pageSize < result.totalRecords,
        albums: result.records.map(a => ({
          id: a.id,
          title: a.title,
          artistId: a.artistId,
          monitored: a.monitored,
          releaseDate: a.releaseDate,
        })),
      });
    },

    lidarr_get_disk_space: async (_args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const diskSpace = await clients.lidarr.getDiskSpace();
      return ok({
        count: diskSpace.length,
        disks: diskSpace.map(d => ({
          path: d.path,
          label: d.label,
          freeSpace: formatBytes(d.freeSpace),
          totalSpace: formatBytes(d.totalSpace),
          usedSpace: formatBytes(d.totalSpace - d.freeSpace),
          freePercent: d.totalSpace > 0
            ? `${((d.freeSpace / d.totalSpace) * 100).toFixed(1)}%`
            : 'unknown',
        })),
      });
    },

    lidarr_get_track_files: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const artistId = args.artistId as number;
      const files = await clients.lidarr.getTrackFiles(artistId);
      return ok({
        count: files.length,
        files: files.map(f => ({
          id: f.id,
          path: f.path,
          size: formatBytes(f.size),
          dateAdded: f.dateAdded,
          quality: f.quality?.quality?.name,
          audioFormat: f.mediaInfo?.audioFormat,
          audioChannels: f.mediaInfo?.audioChannels,
        })),
      });
    },

    lidarr_delete_track_file: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const fileId = args.fileId as number;
      await clients.lidarr.deleteTrackFile(fileId);
      return ok({ success: true, message: `Deleted track file ${fileId}` });
    },

    lidarr_refresh_artist: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const artistId = args.artistId as number;
      const [artist, command] = await Promise.all([
        clients.lidarr.getArtistById(artistId),
        clients.lidarr.refreshArtist(artistId),
      ]);
      return ok({
        success: true,
        message: `Refresh triggered for "${artist.artistName}"`,
        artist: { id: artist.id, artistName: artist.artistName },
        commandId: command.id,
      });
    },

    lidarr_get_history: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const artistId = args.artistId as number | undefined;
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = (args.pageSize as number | undefined) ?? 20;
      const result = await clients.lidarr.getHistory(artistId, page, pageSize);
      return ok({
        totalRecords: result.totalRecords,
        returned: result.records.length,
        ...(artistId !== undefined ? { artistId } : {}),
        records: result.records.map(r => ({
          id: r.id,
          artistId: r.artistId,
          albumId: r.albumId,
          sourceTitle: r.sourceTitle,
          quality: r.quality?.quality?.name,
          date: r.date,
          eventType: r.eventType,
          data: r.data,
        })),
      });
    },

    lidarr_monitor_albums: async (args, clients) => {
      if (!clients.lidarr) throw new Error('Lidarr is not configured');
      const albumIds = args.albumIds as number[];
      const monitored = args.monitored as boolean;
      await clients.lidarr.monitorAlbums(albumIds, monitored);
      return ok({
        success: true,
        message: `Set ${albumIds.length} album(s) to ${monitored ? 'monitored' : 'unmonitored'}`,
        albumIds,
        monitored,
      });
    },
  },
};
