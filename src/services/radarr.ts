/**
 * Radarr (Movies) ToolModule
 *
 * Tool definitions and handlers live together — scroll down from any
 * tool schema to find its implementation directly below it.
 */

import type { ToolModule } from '../types.js';
import { ok } from '../types.js';
import type { BlocklistRecord, QualityProfile, Release } from '../clients/arr-client.js';
import { formatBytes, truncate, paginate, clampLimit, clampOffset, today, daysFromNow } from '../shared/formatting.js';

export const radarrModule: ToolModule = {
  tools: [
    {
      name: 'radarr_get_movies',
      description:
        'Get movies from the Radarr library. Returns summary fields only — use search to filter before paginating. Default limit=25 to keep context usage low.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number', description: 'Results per page (default: 25, max: 100)' },
          offset: { type: 'number', description: 'Skip N results (default: 0)' },
          search: { type: 'string', description: 'Case-insensitive title filter' },
        },
        required: [],
      },
    },
    {
      name: 'radarr_search',
      description:
        'Search for movies by name. Returns top 10 results with tmdbId needed for radarr_add_movie.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          term: { type: 'string', description: 'Movie name to search for' },
        },
        required: ['term'],
      },
    },
    {
      name: 'radarr_get_queue',
      description: 'Get current Radarr download queue. Shows active downloads and their progress.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number', description: 'Max queue items to return (default: 10)' },
        },
        required: [],
      },
    },
    {
      name: 'radarr_get_calendar',
      description: 'Get upcoming movie releases from Radarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          days: { type: 'number', description: 'Days to look ahead (default: 30)' },
        },
        required: [],
      },
    },
    {
      name: 'radarr_search_movie',
      description: 'Trigger a download search for a movie already in the Radarr library.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieId: { type: 'number', description: 'Movie ID (from radarr_get_movies)' },
        },
        required: ['movieId'],
      },
    },
    {
      name: 'radarr_refresh_movie',
      description: 'Trigger a metadata refresh for a specific movie in Radarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieId: { type: 'number', description: 'Movie ID (from radarr_get_movies)' },
        },
        required: ['movieId'],
      },
    },
    {
      name: 'radarr_add_movie',
      description:
        'Add a movie to Radarr. Use radarr_search first to get the tmdbId, radarr_get_root_folders for rootFolderPath, radarr_get_quality_profiles for qualityProfileId, and radarr_get_tags for tag IDs.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tmdbId: { type: 'number', description: 'TMDB ID from radarr_search results' },
          title: { type: 'string', description: 'Movie title' },
          qualityProfileId: { type: 'number', description: 'Quality profile ID' },
          rootFolderPath: { type: 'string', description: 'Root folder path' },
          monitored: { type: 'boolean', description: 'Monitor the movie (default: true)' },
          minimumAvailability: {
            type: 'string',
            enum: ['announced', 'inCinemas', 'released', 'tba'],
            description: 'When to consider available (default: announced)',
          },
          tags: {
            type: 'array',
            items: { type: 'number' },
            description: 'Tag IDs (optional)',
          },
        },
        required: ['tmdbId', 'title', 'qualityProfileId', 'rootFolderPath'],
      },
    },
    {
      name: 'radarr_delete_movie',
      description: 'Remove a movie from Radarr. Optionally delete the files from disk and/or add to import exclusions.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieId: { type: 'number', description: 'Movie ID (from radarr_get_movies)' },
          deleteFiles: { type: 'boolean', description: 'Delete movie files from disk (default: false)' },
          addImportExclusion: { type: 'boolean', description: 'Prevent re-importing this movie (default: false)' },
        },
        required: ['movieId'],
      },
    },
    {
      name: 'radarr_update_movie',
      description: 'Update a movie in Radarr — change monitored status, quality profile, minimum availability, or tags.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieId: { type: 'number', description: 'Movie ID (from radarr_get_movies)' },
          monitored: { type: 'boolean', description: 'Set monitored status' },
          qualityProfileId: { type: 'number', description: 'Change quality profile ID' },
          minimumAvailability: {
            type: 'string',
            enum: ['announced', 'inCinemas', 'released', 'tba'],
            description: 'Change minimum availability',
          },
          tags: { type: 'array', items: { type: 'number' }, description: 'Replace tag IDs' },
        },
        required: ['movieId'],
      },
    },
    {
      name: 'radarr_get_disk_space',
      description: 'Get disk space usage for all Radarr root folders and mounts.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_get_history',
      description: 'Get download history. Filter to a specific movie with movieId, or leave blank for recent activity across all movies.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieId: { type: 'number', description: 'Filter to a specific movie (optional)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Results per page (default: 20, max: 100)' },
        },
        required: [],
      },
    },
    {
      name: 'radarr_remove_from_queue',
      description: 'Remove one or more items from the Radarr download queue. Optionally blocklist them to prevent re-grabbing.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ids: {
            type: 'array',
            items: { type: 'number' },
            description: 'Queue item ID(s) to remove (from radarr_get_queue)',
          },
          blocklist: { type: 'boolean', description: 'Add to blocklist to prevent re-grab (default: false)' },
          removeFromClient: { type: 'boolean', description: 'Also remove from download client (default: true)' },
        },
        required: ['ids'],
      },
    },
    {
      name: 'radarr_get_wanted_missing',
      description: 'Get paginated list of monitored movies that are missing (not yet downloaded).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Results per page (default: 20, max: 100)' },
        },
        required: [],
      },
    },
    {
      name: 'radarr_get_wanted_cutoff',
      description: 'Get paginated list of movies that have a file but have not met the quality cutoff (upgrade candidates).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Results per page (default: 20, max: 100)' },
        },
        required: [],
      },
    },
    {
      name: 'radarr_get_movie_files',
      description: 'Get file details for a specific movie — quality, size, codecs, languages.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieId: { type: 'number', description: 'Movie ID (from radarr_get_movies)' },
        },
        required: ['movieId'],
      },
    },
    {
      name: 'radarr_delete_movie_file',
      description: 'Delete a specific movie file from disk (the movie remains in Radarr as unmonitored).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          fileId: { type: 'number', description: 'File ID (from radarr_get_movie_files)' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'radarr_get_blocklist',
      description: 'Get the Radarr blocklist — releases that were blocked/failed and won\'t be re-grabbed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Results per page (default: 20, max: 100)' },
        },
        required: [],
      },
    },
    {
      name: 'radarr_get_quality_profile',
      description: 'Get a single Radarr quality profile by ID with full details including quality items and custom format scores. Required before calling radarr_update_quality_profile.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          profileId: { type: 'number', description: 'Quality profile ID (from radarr_get_quality_profiles)' },
        },
        required: ['profileId'],
      },
    },
    {
      name: 'radarr_update_quality_profile',
      description: 'Update a Radarr quality profile — change upgradeAllowed, minFormatScore, cutoffFormatScore, cutoff quality, or individual custom format scores. Fetches the existing profile first to avoid overwriting unrelated fields.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          profileId: { type: 'number', description: 'Quality profile ID (from radarr_get_quality_profiles)' },
          upgradeAllowed: { type: 'boolean', description: 'Allow quality upgrades' },
          cutoff: { type: 'number', description: 'Cutoff quality ID' },
          minFormatScore: { type: 'number', description: 'Minimum custom format score required to import' },
          cutoffFormatScore: { type: 'number', description: 'Custom format score needed to stop upgrading' },
          formatScores: {
            type: 'array',
            description: 'Update scores for specific custom formats',
            items: {
              type: 'object',
              properties: {
                formatId: { type: 'number', description: 'Custom format ID' },
                score: { type: 'number', description: 'New score (negative to penalize, positive to prefer)' },
              },
              required: ['formatId', 'score'],
            },
          },
        },
        required: ['profileId'],
      },
    },
    {
      name: 'radarr_list_custom_formats',
      description: 'List all custom formats defined in Radarr with their IDs and specifications.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_create_tag',
      description: 'Create a new tag in Radarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          label: { type: 'string', description: 'Tag label/name' },
        },
        required: ['label'],
      },
    },
    {
      name: 'radarr_delete_tag',
      description: 'Delete a tag from Radarr by ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tagId: { type: 'number', description: 'Tag ID (from radarr_get_tags)' },
        },
        required: ['tagId'],
      },
    },
    {
      name: 'radarr_get_import_exclusions',
      description: 'List movies that are excluded from import (blocked from being re-added after deletion).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_delete_import_exclusion',
      description: 'Remove a movie from the Radarr import exclusion list, allowing it to be re-added.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          exclusionId: { type: 'number', description: 'Exclusion ID (from radarr_get_import_exclusions)' },
        },
        required: ['exclusionId'],
      },
    },
    {
      name: 'radarr_trigger_cutoff_unmet_search',
      description: 'Trigger a search for all monitored movies that have a file but have not met the quality cutoff (upgrade candidates).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_trigger_refresh_monitored_downloads',
      description: 'Trigger Radarr to refresh its view of monitored downloads — useful for checking stalled or stuck downloads.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_trigger_rss_sync',
      description: 'Trigger an immediate RSS feed sync across all configured indexers in Radarr.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_delete_from_blocklist',
      description: 'Remove an entry from the Radarr blocklist so that release can be grabbed again.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          blocklistId: { type: 'number', description: 'Blocklist entry ID (from radarr_get_blocklist)' },
        },
        required: ['blocklistId'],
      },
    },
    {
      name: 'radarr_search_releases',
      description: 'Search indexers for available releases for a specific movie. Returns release candidates with quality, size, seeders, and rejection reasons. Use the guid and indexerId from results to grab a release with radarr_grab_release.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieId: { type: 'number', description: 'Movie ID (from radarr_get_movies)' },
        },
        required: ['movieId'],
      },
    },
    {
      name: 'radarr_grab_release',
      description: 'Grab a specific release and send it to the download client. Use radarr_search_releases first to find the guid and indexerId.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          guid: { type: 'string', description: 'Release GUID (from radarr_search_releases)' },
          indexerId: { type: 'number', description: 'Indexer ID (from radarr_search_releases)' },
        },
        required: ['guid', 'indexerId'],
      },
    },
  ],

  handlers: {
    radarr_get_movies: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const limit = clampLimit((args.limit as number | undefined) ?? 25);
      const offset = clampOffset((args.offset as number | undefined) ?? 0);
      const search = (args.search as string | undefined)?.trim().toLowerCase();

      const all = await clients.radarr.getMovies();
      const filtered = search ? all.filter(m => m.title.toLowerCase().includes(search)) : all;
      const page = filtered.slice(offset, offset + limit);

      return ok({
        ...paginate(
          page.map(m => ({
            id: m.id,
            title: m.title,
            year: m.year,
            status: m.status,
            hasFile: m.hasFile,
            sizeOnDisk: formatBytes(m.sizeOnDisk),
            monitored: m.monitored,
            studio: m.studio,
            qualityProfileId: m.qualityProfileId,
          })),
          filtered.length,
          offset,
          limit
        ),
        ...(search ? { search } : {}),
        totalLibrary: all.length,
      });
    },

    radarr_search: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const term = args.term as string;
      const results = await clients.radarr.searchMovies(term);
      return ok({
        count: results.length,
        results: results.slice(0, 10).map(r => ({
          title: r.title,
          year: r.year,
          tmdbId: r.tmdbId,
          imdbId: r.imdbId,
          status: r.status,
          overview: truncate(r.overview, 200),
        })),
      });
    },

    radarr_get_queue: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const limit = clampLimit((args.limit as number | undefined) ?? 10);
      const queue = await clients.radarr.getQueue();
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

    radarr_get_calendar: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const days = (args.days as number | undefined) ?? 30;
      const calendar = await clients.radarr.getCalendar(today(), daysFromNow(days));
      const items = calendar as Array<Record<string, unknown>>;
      return ok({
        days,
        count: items.length,
        releases: items.map(m => ({
          id: m['id'],
          title: m['title'],
          year: m['year'],
          inCinemas: m['inCinemas'],
          physicalRelease: m['physicalRelease'],
          digitalRelease: m['digitalRelease'],
          status: m['status'],
          hasFile: m['hasFile'],
        })),
      });
    },

    radarr_search_movie: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const movieId = args.movieId as number;
      const result = await clients.radarr.searchMovie(movieId);
      return ok({ success: true, message: 'Search triggered for movie', commandId: result.id });
    },

    radarr_refresh_movie: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const movieId = args.movieId as number;
      const [movie, result] = await Promise.all([
        clients.radarr.getMovieById(movieId),
        clients.radarr.refreshMovie(movieId),
      ]);
      return ok({
        success: true,
        message: 'Metadata refresh triggered',
        movie: { id: movie.id, title: movie.title, year: movie.year },
        commandId: result.id,
      });
    },

    radarr_add_movie: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { tmdbId, title, qualityProfileId, rootFolderPath, monitored, minimumAvailability, tags } =
        args as {
          tmdbId: number;
          title: string;
          qualityProfileId: number;
          rootFolderPath: string;
          monitored?: boolean;
          minimumAvailability?: string;
          tags?: number[];
        };
      const added = await clients.radarr.addMovie({
        tmdbId,
        title,
        qualityProfileId,
        rootFolderPath,
        monitored,
        minimumAvailability,
        tags: tags ?? [],
      });
      return ok({
        success: true,
        message: `Added "${added.title}" (${added.year}) to Radarr`,
        id: added.id,
        path: added.path,
        monitored: added.monitored,
      });
    },

    radarr_delete_movie: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { movieId, deleteFiles = false, addImportExclusion = false } = args as {
        movieId: number;
        deleteFiles?: boolean;
        addImportExclusion?: boolean;
      };
      const movie = await clients.radarr.getMovieById(movieId);
      await clients.radarr.deleteMovie(movieId, deleteFiles, addImportExclusion);
      return ok({
        success: true,
        message: `Removed "${movie.title}" (${movie.year}) from Radarr`,
        deletedFiles: deleteFiles,
        addedToExclusions: addImportExclusion,
      });
    },

    radarr_update_movie: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { movieId, monitored, qualityProfileId, minimumAvailability, tags } = args as {
        movieId: number;
        monitored?: boolean;
        qualityProfileId?: number;
        minimumAvailability?: string;
        tags?: number[];
      };
      const changes: Record<string, unknown> = {};
      if (monitored !== undefined) changes['monitored'] = monitored;
      if (qualityProfileId !== undefined) changes['qualityProfileId'] = qualityProfileId;
      if (minimumAvailability !== undefined) changes['minimumAvailability'] = minimumAvailability;
      if (tags !== undefined) changes['tags'] = tags;
      const updated = await clients.radarr.updateMovie(movieId, changes);
      return ok({
        success: true,
        message: `Updated "${updated.title}" (${updated.year})`,
        id: updated.id,
        monitored: updated.monitored,
        qualityProfileId: updated.qualityProfileId,
        minimumAvailability: updated.minimumAvailability,
        tags: updated.tags,
      });
    },

    radarr_get_disk_space: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const diskSpace = await clients.radarr.getDiskSpace();
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

    radarr_get_history: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { movieId, page = 1, pageSize = 20 } = args as {
        movieId?: number;
        page?: number;
        pageSize?: number;
      };
      const clampedPageSize = clampLimit(pageSize);
      const history = await clients.radarr.getHistory(movieId, page, clampedPageSize);
      // getHistory for a specific movie returns an array, not a paged object
      const isArray = Array.isArray(history);
      const records = isArray
        ? (history as unknown as Array<Record<string, unknown>>)
        : ((history as unknown as { records: Array<Record<string, unknown>>; totalRecords: number }).records);
      const total = isArray ? records.length : (history as unknown as { totalRecords: number }).totalRecords;
      return ok({
        totalRecords: total,
        returned: records.length,
        ...(movieId ? { movieId } : {}),
        records: records.map(r => ({
          id: r['id'],
          movieId: r['movieId'],
          sourceTitle: r['sourceTitle'],
          eventType: r['eventType'],
          date: r['date'],
          quality: (r['quality'] as Record<string, unknown> | undefined)?.['quality'],
          languages: r['languages'],
          downloadId: r['downloadId'],
          data: r['data'],
        })),
      });
    },

    radarr_remove_from_queue: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { ids, blocklist = false, removeFromClient = true } = args as {
        ids: number[];
        blocklist?: boolean;
        removeFromClient?: boolean;
      };
      if (ids.length === 1) {
        await clients.radarr.removeFromQueue(ids[0], blocklist, removeFromClient);
      } else {
        await clients.radarr.removeFromQueueBulk(ids, blocklist, removeFromClient);
      }
      return ok({
        success: true,
        message: `Removed ${ids.length} item(s) from queue`,
        ids,
        blocklisted: blocklist,
        removedFromClient: removeFromClient,
      });
    },

    radarr_get_wanted_missing: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { page = 1, pageSize = 20 } = args as { page?: number; pageSize?: number };
      const wanted = await clients.radarr.getWantedMissing(page, clampLimit(pageSize));
      return ok({
        totalRecords: wanted.totalRecords,
        page: wanted.page,
        pageSize: wanted.pageSize,
        returned: wanted.records.length,
        hasMore: wanted.page * wanted.pageSize < wanted.totalRecords,
        movies: wanted.records.map(m => ({
          id: m.id,
          title: m.title,
          year: m.year,
          status: m.status,
          monitored: m.monitored,
          minimumAvailability: m.minimumAvailability,
          qualityProfileId: m.qualityProfileId,
        })),
      });
    },

    radarr_get_wanted_cutoff: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { page = 1, pageSize = 20 } = args as { page?: number; pageSize?: number };
      const wanted = await clients.radarr.getWantedCutoff(page, clampLimit(pageSize));
      return ok({
        totalRecords: wanted.totalRecords,
        page: wanted.page,
        pageSize: wanted.pageSize,
        returned: wanted.records.length,
        hasMore: wanted.page * wanted.pageSize < wanted.totalRecords,
        movies: wanted.records.map(m => ({
          id: m.id,
          title: m.title,
          year: m.year,
          hasFile: m.hasFile,
          sizeOnDisk: formatBytes(m.sizeOnDisk),
          monitored: m.monitored,
          qualityProfileId: m.qualityProfileId,
        })),
      });
    },

    radarr_get_movie_files: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const movieId = args.movieId as number;
      const files = await clients.radarr.getMovieFiles(movieId);
      return ok({
        count: files.length,
        files: files.map(f => ({
          id: f.id,
          relativePath: f.relativePath,
          size: formatBytes(f.size),
          sizeBytes: f.size,
          dateAdded: f.dateAdded,
          quality: f.quality?.quality?.name,
          qualityCutoffNotMet: f.qualityCutoffNotMet,
          videoCodec: f.mediaInfo?.videoCodec,
          audioCodec: f.mediaInfo?.audioCodec,
          audioChannels: f.mediaInfo?.audioChannels,
          languages: f.languages?.map(l => l.name),
          edition: f.edition || undefined,
          dynamicRange: f.mediaInfo?.videoDynamicRangeType || undefined,
        })),
      });
    },

    radarr_delete_movie_file: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const fileId = args.fileId as number;
      await clients.radarr.deleteMovieFile(fileId);
      return ok({ success: true, message: `Deleted movie file ${fileId} from disk` });
    },

    radarr_get_blocklist: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { page = 1, pageSize = 20 } = args as { page?: number; pageSize?: number };
      const blocklist = await clients.radarr.getBlocklist(page, clampLimit(pageSize));
      const records = Array.isArray(blocklist) ? blocklist as unknown as BlocklistRecord[] : (blocklist as { records: BlocklistRecord[]; totalRecords: number }).records;
      const total = Array.isArray(blocklist) ? records.length : (blocklist as { totalRecords: number }).totalRecords;
      return ok({
        totalRecords: total,
        returned: records.length,
        entries: records.map(b => ({
          id: b.id,
          movieId: b.movieId,
          sourceTitle: b.sourceTitle,
          quality: b.quality?.quality?.name,
          date: b.date,
          protocol: b.protocol,
          indexer: b.indexer,
          message: b.message,
        })),
      });
    },

    radarr_delete_from_blocklist: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const blocklistId = args.blocklistId as number;
      await clients.radarr.deleteFromBlocklist(blocklistId);
      return ok({ success: true, message: `Removed blocklist entry ${blocklistId}` });
    },

    radarr_get_quality_profile: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const profileId = args.profileId as number;
      const profile = await clients.radarr.getQualityProfile(profileId);
      return ok({
        id: profile.id,
        name: profile.name,
        upgradeAllowed: profile.upgradeAllowed,
        cutoff: profile.cutoff,
        minFormatScore: profile.minFormatScore,
        cutoffFormatScore: profile.cutoffFormatScore,
        qualities: profile.items
          .filter(i => i.allowed)
          .map(i => i.quality ? i.quality.name : i.name),
        customFormats: profile.formatItems.map(f => ({ id: f.format, name: f.name, score: f.score })),
      });
    },

    radarr_update_quality_profile: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { profileId, upgradeAllowed, cutoff, minFormatScore, cutoffFormatScore, formatScores } = args as {
        profileId: number;
        upgradeAllowed?: boolean;
        cutoff?: number;
        minFormatScore?: number;
        cutoffFormatScore?: number;
        formatScores?: Array<{ formatId: number; score: number }>;
      };
      const existing: QualityProfile = await clients.radarr.getQualityProfile(profileId);
      if (upgradeAllowed !== undefined) existing.upgradeAllowed = upgradeAllowed;
      if (cutoff !== undefined) existing.cutoff = cutoff;
      if (minFormatScore !== undefined) existing.minFormatScore = minFormatScore;
      if (cutoffFormatScore !== undefined) existing.cutoffFormatScore = cutoffFormatScore;
      if (formatScores) {
        const scoreMap = new Map(formatScores.map(f => [f.formatId, f.score]));
        existing.formatItems = existing.formatItems.map(f =>
          scoreMap.has(f.format) ? { ...f, score: scoreMap.get(f.format)! } : f
        );
      }
      const updated = await clients.radarr.updateQualityProfile(profileId, existing);
      return ok({
        success: true,
        message: `Updated quality profile "${updated.name}"`,
        id: updated.id,
        name: updated.name,
        upgradeAllowed: updated.upgradeAllowed,
        minFormatScore: updated.minFormatScore,
        cutoffFormatScore: updated.cutoffFormatScore,
        customFormats: updated.formatItems.map(f => ({ id: f.format, name: f.name, score: f.score })),
      });
    },

    radarr_list_custom_formats: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const formats = await clients.radarr.getCustomFormats();
      return ok({
        count: formats.length,
        customFormats: formats.map(f => ({
          id: f.id,
          name: f.name,
          includeWhenRenaming: f.includeCustomFormatWhenRenaming,
          specifications: f.specifications.map(s => ({ name: s.name, implementation: s.implementationName ?? s.implementation, negate: s.negate, required: s.required })),
        })),
      });
    },

    radarr_create_tag: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const label = args.label as string;
      const tag = await clients.radarr.createTag(label);
      return ok({ success: true, message: `Created tag "${tag.label}"`, id: tag.id, label: tag.label });
    },

    radarr_delete_tag: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const tagId = args.tagId as number;
      await clients.radarr.deleteTag(tagId);
      return ok({ success: true, message: `Deleted tag ${tagId}` });
    },

    radarr_get_import_exclusions: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const exclusions = await clients.radarr.getImportExclusions();
      return ok({
        count: exclusions.length,
        exclusions: exclusions.map(e => ({ id: e.id, title: e.title, tmdbId: e.tmdbId, year: e.year })),
      });
    },

    radarr_delete_import_exclusion: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const exclusionId = args.exclusionId as number;
      await clients.radarr.deleteImportExclusion(exclusionId);
      return ok({ success: true, message: `Removed exclusion ${exclusionId} — movie can now be re-added` });
    },

    radarr_trigger_cutoff_unmet_search: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const result = await clients.radarr.runCommand('CutoffUnmetSearch');
      return ok({ success: true, message: 'Triggered cutoff-unmet movie search', commandId: result.id });
    },

    radarr_trigger_refresh_monitored_downloads: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const result = await clients.radarr.runCommand('RefreshMonitoredDownloads');
      return ok({ success: true, message: 'Triggered refresh of monitored downloads', commandId: result.id });
    },

    radarr_trigger_rss_sync: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const result = await clients.radarr.runCommand('RssSync');
      return ok({ success: true, message: 'Triggered RSS sync', commandId: result.id });
    },

    radarr_search_releases: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const movieId = args.movieId as number;
      const releases = await clients.radarr.searchReleases(movieId);
      return ok({
        count: releases.length,
        releases: releases.map((r: Release) => ({
          guid: r.guid,
          indexerId: r.indexerId,
          indexer: r.indexer,
          title: r.title,
          size: formatBytes(r.size),
          sizeBytes: r.size,
          quality: r.quality?.quality?.name,
          customFormatScore: r.customFormatScore,
          seeders: r.seeders,
          leechers: r.leechers,
          protocol: r.protocol,
          indexerFlags: r.indexerFlags,
          age: r.age,
          approved: r.approved,
          rejected: r.rejected,
          rejections: r.rejections,
          publishDate: r.publishDate,
        })),
      });
    },

    radarr_grab_release: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const guid = args.guid as string;
      const indexerId = args.indexerId as number;
      const result = await clients.radarr.grabRelease(guid, indexerId);
      return ok({
        success: true,
        message: `Grabbed release "${result.title}"`,
        title: result.title,
        quality: result.quality?.quality?.name,
        indexer: result.indexer,
        size: formatBytes(result.size),
      });
    },
  },
};
