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
      description: 'Trigger a metadata refresh for a specific movie in Radarr. Omit movieId to refresh metadata for all movies.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieId: { type: 'number', description: 'Movie ID (from radarr_get_movies). Omit to refresh all movies.' },
        },
        required: [],
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
      name: 'radarr_get_custom_format',
      description: 'Get a single custom format by ID, including full specification details.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          formatId: { type: 'number', description: 'Custom format ID (from radarr_list_custom_formats)' },
        },
        required: ['formatId'],
      },
    },
    {
      name: 'radarr_create_custom_format',
      description: 'Create a new custom format in Radarr. Pass a full specifications array to define matching rules.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Custom format name' },
          includeWhenRenaming: { type: 'boolean', description: 'Include custom format token in file rename' },
          specifications: {
            type: 'array',
            description: 'Array of specification objects defining matching rules',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                implementation: { type: 'string', description: 'e.g. ReleaseTitleSpecification' },
                negate: { type: 'boolean' },
                required: { type: 'boolean' },
                fields: {
                  type: 'array',
                  items: { type: 'object', properties: { name: { type: 'string' }, value: {} }, required: ['name', 'value'] },
                },
              },
              required: ['name', 'implementation', 'negate', 'required', 'fields'],
            },
          },
        },
        required: ['name', 'specifications'],
      },
    },
    {
      name: 'radarr_update_custom_format',
      description: 'Update an existing custom format. Fetches the current format first then applies your changes. Only provide fields you want to change.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          formatId: { type: 'number', description: 'Custom format ID to update' },
          name: { type: 'string', description: 'New name (optional)' },
          includeWhenRenaming: { type: 'boolean', description: 'Update include-when-renaming flag (optional)' },
          specifications: {
            type: 'array',
            description: 'Full replacement specifications array (optional — replaces all specs if provided)',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                implementation: { type: 'string' },
                negate: { type: 'boolean' },
                required: { type: 'boolean' },
                fields: {
                  type: 'array',
                  items: { type: 'object', properties: { name: { type: 'string' }, value: {} }, required: ['name', 'value'] },
                },
              },
              required: ['name', 'implementation', 'negate', 'required', 'fields'],
            },
          },
        },
        required: ['formatId'],
      },
    },
    {
      name: 'radarr_delete_custom_format',
      description: 'Delete a custom format from Radarr by ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          formatId: { type: 'number', description: 'Custom format ID to delete' },
        },
        required: ['formatId'],
      },
    },
    {
      name: 'radarr_get_system_tasks',
      description: 'List all scheduled background tasks in Radarr with their last/next run times and current status.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_get_logs',
      description: 'Fetch recent application log entries from Radarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          pageSize: { type: 'number', description: 'Number of log entries to return (default: 20, max: 100)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
          level: { type: 'string', enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'], description: 'Filter by log level (optional)' },
        },
        required: [],
      },
    },
    {
      name: 'radarr_trigger_backup',
      description: 'Create an on-demand backup of Radarr configuration and database.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_get_notifications',
      description: 'List all configured notification providers in Radarr (webhooks, email, Slack, etc.).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_update_quality_definition',
      description: 'Update the min/max/preferred size limits for a quality tier in Radarr. WARNING: misconfigured sizes can block all imports — verify values before applying.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          definitionId: { type: 'number', description: 'Quality definition ID (from radarr_review_setup)' },
          minSize: { type: 'number', description: 'Minimum size in MB (optional)' },
          maxSize: { type: 'number', description: 'Maximum size in MB, use 0 for unlimited (optional)' },
          preferredSize: { type: 'number', description: 'Preferred size in MB (optional)' },
        },
        required: ['definitionId'],
      },
    },
    {
      name: 'radarr_get_import_lists',
      description: 'List all configured import list sources in Radarr (Trakt, IMDb, Plex Watchlist, etc.).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_update_import_list',
      description: 'Update an import list in Radarr — primarily used to enable or disable it.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          listId: { type: 'number', description: 'Import list ID (from radarr_get_import_lists)' },
          enabled: { type: 'boolean', description: 'Enable or disable the import list (optional)' },
          enableAuto: { type: 'boolean', description: 'Enable automatic add for matched items (optional)' },
        },
        required: ['listId'],
      },
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
    {
      name: 'radarr_get_command_status',
      description: 'Poll the status of an async command previously triggered (e.g. RescanMovie, RefreshMovie, MissingMoviesSearch). Pass the commandId returned by the trigger tool.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          commandId: { type: 'number', description: 'Command ID returned by a trigger tool' },
        },
        required: ['commandId'],
      },
    },
    {
      name: 'radarr_trigger_rescan_movies',
      description: 'Rescan disk for all movies to link existing files Radarr does not know about.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_trigger_missing_search',
      description: 'Trigger a search for all missing monitored movies.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_trigger_rename_movies',
      description: 'Rename movie files on disk to match current Radarr naming settings. Pass specific movieIds or omit to rename all.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieIds: { type: 'array', items: { type: 'number' }, description: 'Movie IDs to rename. Omit for all movies.' },
        },
        required: [],
      },
    },
    {
      name: 'radarr_trigger_downloaded_scan',
      description: 'Force a scan of the completed downloads folder to import any files that were not auto-imported.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'radarr_bulk_update_movies',
      description: 'Bulk update multiple Radarr movies at once — change monitored status, quality profile, or tags in a single API call. Use this instead of calling radarr_update_movie in a loop.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieIds: { type: 'array', items: { type: 'number' }, description: 'List of movie IDs to update' },
          monitored: { type: 'boolean', description: 'Set monitored status for all specified movies' },
          qualityProfileId: { type: 'number', description: 'Change quality profile for all specified movies' },
          tags: { type: 'array', items: { type: 'number' }, description: 'Tag IDs to apply' },
          applyTags: { type: 'string', enum: ['add', 'remove', 'replace'], description: 'How to apply tags (default: add)' },
        },
        required: ['movieIds'],
      },
    },
    {
      name: 'radarr_bulk_delete_movies',
      description: 'Bulk delete multiple movies from Radarr. WARNING: Setting deleteFiles to true is destructive and irreversible — files will be permanently removed from disk.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          movieIds: { type: 'array', items: { type: 'number' }, description: 'List of movie IDs to delete' },
          deleteFiles: { type: 'boolean', description: 'Delete movie files from disk (default: false) — IRREVERSIBLE' },
          addImportExclusion: { type: 'boolean', description: 'Prevent re-importing these movies (default: false)' },
        },
        required: ['movieIds'],
      },
    },
    {
      name: 'radarr_get_manual_import',
      description: 'Scan a folder and preview how Radarr would match each file for manual import. Shows quality, matched movie, and any rejection reasons. Use radarr_process_manual_import to confirm.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          folder: { type: 'string', description: 'Absolute path to the folder to scan' },
          filterExistingFiles: { type: 'boolean', description: 'Only show files not already in the Radarr library (default: true)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Results per page (default: 50)' },
        },
        required: ['folder'],
      },
    },
    {
      name: 'radarr_process_manual_import',
      description: 'Confirm and import files identified by radarr_get_manual_import. Pass the items array from the preview response (optionally filtered to only importable items with no rejections).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          items: { type: 'array', description: 'Items from radarr_get_manual_import to import (exclude items with rejections)' },
        },
        required: ['items'],
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
          trackedDownloadStatus: q.trackedDownloadStatus,
          trackedDownloadState: q.trackedDownloadState,
          ...(q.statusMessages?.length ? { statusMessages: q.statusMessages.flatMap(m => m.messages) } : {}),
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
      const movieId = args.movieId as number | undefined;
      if (movieId !== undefined) {
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
      }
      const result = await clients.radarr.refreshMovie();
      return ok({ success: true, message: 'Metadata refresh triggered for all movies', commandId: result.id });
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

    radarr_get_custom_format: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const formatId = args.formatId as number;
      const f = await clients.radarr.getCustomFormat(formatId);
      return ok({
        id: f.id,
        name: f.name,
        includeWhenRenaming: f.includeCustomFormatWhenRenaming,
        specifications: f.specifications.map(s => ({
          id: s.id,
          name: s.name,
          implementation: s.implementationName ?? s.implementation,
          negate: s.negate,
          required: s.required,
          fields: s.fields,
        })),
      });
    },

    radarr_create_custom_format: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { name, includeWhenRenaming, specifications } = args as {
        name: string;
        includeWhenRenaming?: boolean;
        specifications: Array<{ name: string; implementation: string; negate: boolean; required: boolean; fields: Array<{ name: string; value: unknown }> }>;
      };
      const created = await clients.radarr.createCustomFormat({
        name,
        includeCustomFormatWhenRenaming: includeWhenRenaming ?? false,
        specifications,
      });
      return ok({
        success: true,
        message: `Created custom format "${created.name}"`,
        id: created.id,
        name: created.name,
      });
    },

    radarr_update_custom_format: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { formatId, name, includeWhenRenaming, specifications } = args as {
        formatId: number;
        name?: string;
        includeWhenRenaming?: boolean;
        specifications?: Array<{ name: string; implementation: string; negate: boolean; required: boolean; fields: Array<{ name: string; value: unknown }> }>;
      };
      const existing = await clients.radarr.getCustomFormat(formatId);
      if (name !== undefined) existing.name = name;
      if (includeWhenRenaming !== undefined) existing.includeCustomFormatWhenRenaming = includeWhenRenaming;
      if (specifications !== undefined) existing.specifications = specifications;
      const updated = await clients.radarr.updateCustomFormat(formatId, existing);
      return ok({
        success: true,
        message: `Updated custom format "${updated.name}"`,
        id: updated.id,
        name: updated.name,
      });
    },

    radarr_delete_custom_format: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const formatId = args.formatId as number;
      await clients.radarr.deleteCustomFormat(formatId);
      return ok({ success: true, message: `Deleted custom format ${formatId}` });
    },

    radarr_get_system_tasks: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const tasks = await clients.radarr.getSystemTasks();
      return ok({
        count: tasks.length,
        tasks: tasks.map(t => ({
          name: t.name,
          taskName: t.taskName,
          intervalHours: t.interval / 60,
          lastExecution: t.lastExecution,
          nextExecution: t.nextExecution,
          lastDuration: t.lastDuration,
          isRunning: t.isRunning,
        })),
      });
    },

    radarr_get_logs: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = Math.min((args.pageSize as number | undefined) ?? 20, 100);
      const level = args.level as string | undefined;
      const result = await clients.radarr.getLogs(page, pageSize, level);
      return ok({
        page: result.page,
        pageSize: result.pageSize,
        totalRecords: result.totalRecords,
        records: result.records.map(r => ({
          time: r.time,
          level: r.level,
          logger: r.logger,
          message: r.message,
          ...(r.exception ? { exception: r.exception } : {}),
          ...(r.exceptionType ? { exceptionType: r.exceptionType } : {}),
        })),
      });
    },

    radarr_trigger_backup: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const result = await clients.radarr.triggerBackup();
      return ok({ success: true, message: 'Backup triggered', commandId: result.id });
    },

    radarr_get_notifications: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const notifications = await clients.radarr.getNotifications();
      return ok({
        count: notifications.length,
        notifications: notifications.map(n => ({
          id: n.id,
          name: n.name,
          implementation: n.implementationName,
          tags: n.tags,
          triggers: {
            onGrab: n.onGrab,
            onDownload: n.onDownload,
            onUpgrade: n.onUpgrade,
            onRename: n.onRename,
            onHealthIssue: n.onHealthIssue,
            onApplicationUpdate: n.onApplicationUpdate,
          },
        })),
      });
    },

    radarr_update_quality_definition: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { definitionId, minSize, maxSize, preferredSize } = args as {
        definitionId: number;
        minSize?: number;
        maxSize?: number;
        preferredSize?: number;
      };
      const definitions = await clients.radarr.getQualityDefinitions();
      const existing = definitions.find(d => d.id === definitionId);
      if (!existing) return { content: [{ type: 'text' as const, text: JSON.stringify({ isError: true, message: `Quality definition ${definitionId} not found` }) }], isError: true };
      if (minSize !== undefined) existing.minSize = minSize;
      if (maxSize !== undefined) existing.maxSize = maxSize;
      if (preferredSize !== undefined) existing.preferredSize = preferredSize;
      const updated = await clients.radarr.updateQualityDefinition(definitionId, existing);
      return ok({
        success: true,
        message: `Updated quality definition "${updated.title}"`,
        id: updated.id,
        title: updated.title,
        minSize: updated.minSize,
        maxSize: updated.maxSize,
        preferredSize: updated.preferredSize,
      });
    },

    radarr_get_import_lists: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const lists = await clients.radarr.getImportLists();
      return ok({
        count: lists.length,
        importLists: lists.map(l => ({
          id: l.id,
          name: l.name,
          implementation: l.implementationName,
          enabled: l.enabled,
          enableAuto: l.enableAuto,
          shouldMonitor: l.shouldMonitor,
          qualityProfileId: l.qualityProfileId,
          tags: l.tags,
        })),
      });
    },

    radarr_update_import_list: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { listId, enabled, enableAuto } = args as {
        listId: number;
        enabled?: boolean;
        enableAuto?: boolean;
      };
      const lists = await clients.radarr.getImportLists();
      const existing = lists.find(l => l.id === listId);
      if (!existing) return { content: [{ type: 'text' as const, text: JSON.stringify({ isError: true, message: `Import list ${listId} not found` }) }], isError: true };
      if (enabled !== undefined) existing.enabled = enabled;
      if (enableAuto !== undefined) existing.enableAuto = enableAuto;
      const updated = await clients.radarr.updateImportList(listId, existing);
      return ok({
        success: true,
        message: `Updated import list "${updated.name}"`,
        id: updated.id,
        name: updated.name,
        enabled: updated.enabled,
        enableAuto: updated.enableAuto,
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

    radarr_get_command_status: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const commandId = args.commandId as number;
      const result = await clients.radarr.getCommandStatus(commandId);
      return ok({ id: result.id, name: result.name, status: result.status, message: result.message, started: result.started, ended: result.ended });
    },

    radarr_trigger_rescan_movies: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const result = await clients.radarr.rescanAllMovies();
      return ok({ success: true, message: 'Disk rescan triggered for all movies', commandId: result.id });
    },

    radarr_trigger_missing_search: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const result = await clients.radarr.runCommand('MissingMoviesSearch');
      return ok({ success: true, message: 'Search triggered for all missing monitored movies', commandId: result.id });
    },

    radarr_trigger_rename_movies: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const movieIds = (args.movieIds as number[] | undefined) ?? [];
      const result = await clients.radarr.runCommand('RenameMovie', { movieIds });
      return ok({ success: true, message: movieIds.length > 0 ? `Rename triggered for ${movieIds.length} movies` : 'Rename triggered for all movies', commandId: result.id });
    },

    radarr_trigger_downloaded_scan: async (_args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const result = await clients.radarr.runCommand('DownloadedMoviesScan');
      return ok({ success: true, message: 'Triggered scan of completed downloads folder', commandId: result.id });
    },

    radarr_bulk_update_movies: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { movieIds, monitored, qualityProfileId, tags, applyTags } = args as {
        movieIds: number[];
        monitored?: boolean;
        qualityProfileId?: number;
        tags?: number[];
        applyTags?: 'add' | 'remove' | 'replace';
      };
      await clients.radarr.bulkUpdateMovies(movieIds, { monitored, qualityProfileId, tags, applyTags });
      return ok({ success: true, message: `Updated ${movieIds.length} movies`, movieIds });
    },

    radarr_bulk_delete_movies: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const { movieIds, deleteFiles = false, addImportExclusion = false } = args as {
        movieIds: number[];
        deleteFiles?: boolean;
        addImportExclusion?: boolean;
      };
      await clients.radarr.bulkDeleteMovies(movieIds, deleteFiles, addImportExclusion);
      return ok({ success: true, message: `Deleted ${movieIds.length} movies`, deletedFiles: deleteFiles, addedToExclusions: addImportExclusion });
    },

    radarr_get_manual_import: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const folder = args.folder as string;
      const filterExistingFiles = (args.filterExistingFiles as boolean | undefined) ?? true;
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = (args.pageSize as number | undefined) ?? 50;
      const items = await clients.radarr.getManualImport(folder, filterExistingFiles, page, pageSize);
      return ok({
        count: items.length,
        items: items.map(i => ({
          id: i.id,
          path: i.path,
          relativePath: i.relativePath,
          movie: i.movie,
          quality: i.quality?.quality?.name,
          size: formatBytes(i.size),
          rejections: i.rejections,
        })),
      });
    },

    radarr_process_manual_import: async (args, clients) => {
      if (!clients.radarr) throw new Error('Radarr is not configured');
      const items = args.items as import('../clients/arr-client.js').ManualImportItem[];
      await clients.radarr.processManualImport(items);
      return ok({ success: true, message: `Submitted ${items.length} items for import` });
    },
  },
};
