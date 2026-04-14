/**
 * Sonarr (TV Series) ToolModule
 *
 * Tool definitions and handlers live together — scroll down from any
 * tool schema to find its implementation directly below it.
 */

import type { ToolModule } from '../types.js';
import { ok } from '../types.js';
import type { SeriesBlocklistRecord, QualityProfile, Release } from '../clients/arr-client.js';
import { formatBytes, truncate, paginate, clampLimit, clampOffset, today, daysFromNow } from '../shared/formatting.js';

export const sonarrModule: ToolModule = {
  tools: [
    {
      name: 'sonarr_get_series',
      description:
        'Get TV series from the Sonarr library. Returns summary fields only — use search to filter before paginating. Default limit=25 to keep context usage low.',
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
      name: 'sonarr_search',
      description:
        'Search for TV series by name. Returns top 10 results with tvdbId needed for sonarr_add_series.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          term: { type: 'string', description: 'Series name to search for' },
        },
        required: ['term'],
      },
    },
    {
      name: 'sonarr_get_queue',
      description: 'Get current Sonarr download queue. Shows active downloads and their progress.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number', description: 'Max queue items to return (default: 10)' },
        },
        required: [],
      },
    },
    {
      name: 'sonarr_get_calendar',
      description: 'Get upcoming episode air dates from Sonarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          days: { type: 'number', description: 'Days to look ahead (default: 7)' },
        },
        required: [],
      },
    },
    {
      name: 'sonarr_get_episodes',
      description:
        'Get episodes for a series. Shows which episodes are available and which are missing. Filter by season to reduce response size.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesId: { type: 'number', description: 'Series ID (from sonarr_get_series)' },
          seasonNumber: { type: 'number', description: 'Filter to a specific season (optional)' },
        },
        required: ['seriesId'],
      },
    },
    {
      name: 'sonarr_search_missing',
      description: 'Trigger a search for all missing episodes in a series.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesId: { type: 'number', description: 'Series ID (from sonarr_get_series)' },
        },
        required: ['seriesId'],
      },
    },
    {
      name: 'sonarr_search_episode',
      description: 'Trigger a download search for specific episode(s).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          episodeIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Episode ID(s) (from sonarr_get_episodes)',
          },
        },
        required: ['episodeIds'],
      },
    },
    {
      name: 'sonarr_refresh_series',
      description: 'Trigger a metadata refresh for a specific series in Sonarr. Omit seriesId to refresh metadata for all series.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesId: { type: 'number', description: 'Series ID (from sonarr_get_series). Omit to refresh all series.' },
        },
        required: [],
      },
    },
    {
      name: 'sonarr_add_series',
      description:
        'Add a TV series to Sonarr. Use sonarr_search first to get the tvdbId, sonarr_get_root_folders for rootFolderPath, sonarr_get_quality_profiles for qualityProfileId, and sonarr_get_tags for tag IDs.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tvdbId: { type: 'number', description: 'TVDB ID from sonarr_search results' },
          title: { type: 'string', description: 'Series title' },
          qualityProfileId: { type: 'number', description: 'Quality profile ID' },
          rootFolderPath: { type: 'string', description: 'Root folder path' },
          monitored: { type: 'boolean', description: 'Monitor the series (default: true)' },
          seasonFolder: { type: 'boolean', description: 'Use season folders (default: true)' },
          tags: {
            type: 'array',
            items: { type: 'number' },
            description: 'Tag IDs (optional)',
          },
        },
        required: ['tvdbId', 'title', 'qualityProfileId', 'rootFolderPath'],
      },
    },
    {
      name: 'sonarr_delete_series',
      description: 'Remove a series from Sonarr. Optionally delete files from disk and/or add to import exclusions.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesId: { type: 'number', description: 'Series ID (from sonarr_get_series)' },
          deleteFiles: { type: 'boolean', description: 'Delete episode files from disk (default: false)' },
          addImportListExclusion: { type: 'boolean', description: 'Prevent re-importing this series (default: false)' },
        },
        required: ['seriesId'],
      },
    },
    {
      name: 'sonarr_update_series',
      description: 'Update a series in Sonarr — change monitored status, quality profile, or tags.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesId: { type: 'number', description: 'Series ID (from sonarr_get_series)' },
          monitored: { type: 'boolean', description: 'Set monitored status' },
          qualityProfileId: { type: 'number', description: 'Change quality profile ID' },
          seasonFolder: { type: 'boolean', description: 'Use season folders' },
          tags: { type: 'array', items: { type: 'number' }, description: 'Replace tag IDs' },
        },
        required: ['seriesId'],
      },
    },
    {
      name: 'sonarr_get_disk_space',
      description: 'Get disk space usage for all Sonarr root folders and mounts.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_get_history',
      description: 'Get download history. Filter to a specific series with seriesId, or leave blank for recent activity across all series.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesId: { type: 'number', description: 'Filter to a specific series (optional)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Results per page (default: 20, max: 100)' },
        },
        required: [],
      },
    },
    {
      name: 'sonarr_remove_from_queue',
      description: 'Remove one or more items from the Sonarr download queue. Optionally blocklist them to prevent re-grabbing.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ids: {
            type: 'array',
            items: { type: 'number' },
            description: 'Queue item ID(s) to remove (from sonarr_get_queue)',
          },
          blocklist: { type: 'boolean', description: 'Add to blocklist to prevent re-grab (default: false)' },
          removeFromClient: { type: 'boolean', description: 'Also remove from download client (default: true)' },
        },
        required: ['ids'],
      },
    },
    {
      name: 'sonarr_get_wanted_missing',
      description: 'Get paginated list of monitored episodes that are missing (not yet downloaded).',
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
      name: 'sonarr_get_wanted_cutoff',
      description: 'Get paginated list of episodes that have a file but have not met the quality cutoff (upgrade candidates).',
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
      name: 'sonarr_get_episode_files',
      description: 'Get file details for episodes in a series — quality, size, codecs, languages. Use seasonNumber to filter to a single season and avoid large responses.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesId: { type: 'number', description: 'Series ID (from sonarr_get_series)' },
          seasonNumber: { type: 'number', description: 'Optional — filter to a specific season' },
        },
        required: ['seriesId'],
      },
    },
    {
      name: 'sonarr_delete_episode_file',
      description: 'Delete a specific episode file from disk (the episode remains in Sonarr as unmonitored).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          fileId: { type: 'number', description: 'Episode file ID (from sonarr_get_episode_files)' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'sonarr_delete_episode_files_bulk',
      description: 'Delete multiple episode files at once. Pass explicit fileIds, or pass seriesId (+ optional seasonNumber) to delete all files for a series or season. Use instead of calling sonarr_delete_episode_file in a loop.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          fileIds: { type: 'array', items: { type: 'number' }, description: 'Explicit list of episode file IDs to delete' },
          seriesId: { type: 'number', description: 'Delete all files for this series (resolved automatically)' },
          seasonNumber: { type: 'number', description: 'Combined with seriesId: only delete files for this season' },
        },
        required: [],
      },
    },
    {
      name: 'sonarr_get_blocklist',
      description: 'Get the Sonarr blocklist — releases that were blocked/failed and won\'t be re-grabbed.',
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
      name: 'sonarr_delete_from_blocklist',
      description: 'Remove an entry from the Sonarr blocklist so that release can be grabbed again.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          blocklistId: { type: 'number', description: 'Blocklist entry ID (from sonarr_get_blocklist)' },
        },
        required: ['blocklistId'],
      },
    },
    {
      name: 'sonarr_monitor_episodes',
      description: 'Bulk set monitored/unmonitored status for specific episodes.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          episodeIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Episode IDs to update (from sonarr_get_episodes)',
          },
          monitored: { type: 'boolean', description: 'Set to true to monitor, false to unmonitor' },
        },
        required: ['episodeIds', 'monitored'],
      },
    },
    {
      name: 'sonarr_get_quality_profile',
      description: 'Get a single Sonarr quality profile by ID with full details including quality items and custom format scores. Required before calling sonarr_update_quality_profile.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          profileId: { type: 'number', description: 'Quality profile ID (from sonarr_get_quality_profiles)' },
        },
        required: ['profileId'],
      },
    },
    {
      name: 'sonarr_update_quality_profile',
      description: 'Update a Sonarr quality profile — change upgradeAllowed, minFormatScore, cutoffFormatScore, cutoff quality, or individual custom format scores. Fetches the existing profile first to avoid overwriting unrelated fields.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          profileId: { type: 'number', description: 'Quality profile ID (from sonarr_get_quality_profiles)' },
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
      name: 'sonarr_list_custom_formats',
      description: 'List all custom formats defined in Sonarr with their IDs and specifications.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_get_custom_format',
      description: 'Get a single custom format by ID, including full specification details.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          formatId: { type: 'number', description: 'Custom format ID (from sonarr_list_custom_formats)' },
        },
        required: ['formatId'],
      },
    },
    {
      name: 'sonarr_create_custom_format',
      description: 'Create a new custom format in Sonarr. Pass a full specifications array to define matching rules.',
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
      name: 'sonarr_update_custom_format',
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
      name: 'sonarr_delete_custom_format',
      description: 'Delete a custom format from Sonarr by ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          formatId: { type: 'number', description: 'Custom format ID to delete' },
        },
        required: ['formatId'],
      },
    },
    {
      name: 'sonarr_get_system_tasks',
      description: 'List all scheduled background tasks in Sonarr with their last/next run times and current status.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_get_logs',
      description: 'Fetch recent application log entries from Sonarr.',
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
      name: 'sonarr_trigger_backup',
      description: 'Create an on-demand backup of Sonarr configuration and database.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_get_notifications',
      description: 'List all configured notification providers in Sonarr (webhooks, email, Slack, etc.).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_update_quality_definition',
      description: 'Update the min/max/preferred size limits for a quality tier in Sonarr. WARNING: misconfigured sizes can block all imports — verify values before applying.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          definitionId: { type: 'number', description: 'Quality definition ID (from sonarr_review_setup)' },
          minSize: { type: 'number', description: 'Minimum size in MB (optional)' },
          maxSize: { type: 'number', description: 'Maximum size in MB, use 0 for unlimited (optional)' },
          preferredSize: { type: 'number', description: 'Preferred size in MB (optional)' },
        },
        required: ['definitionId'],
      },
    },
    {
      name: 'sonarr_get_import_lists',
      description: 'List all configured import list sources in Sonarr (Trakt, IMDb, Plex Watchlist, etc.).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_update_import_list',
      description: 'Update an import list in Sonarr — primarily used to enable or disable it.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          listId: { type: 'number', description: 'Import list ID (from sonarr_get_import_lists)' },
          enabled: { type: 'boolean', description: 'Enable or disable the import list (optional)' },
          enableAuto: { type: 'boolean', description: 'Enable automatic add for matched items (optional)' },
        },
        required: ['listId'],
      },
    },
    {
      name: 'sonarr_create_tag',
      description: 'Create a new tag in Sonarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          label: { type: 'string', description: 'Tag label/name' },
        },
        required: ['label'],
      },
    },
    {
      name: 'sonarr_delete_tag',
      description: 'Delete a tag from Sonarr by ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tagId: { type: 'number', description: 'Tag ID (from sonarr_get_tags)' },
        },
        required: ['tagId'],
      },
    },
    {
      name: 'sonarr_get_import_exclusions',
      description: 'List series that are excluded from import (blocked from being re-added after deletion).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_delete_import_exclusion',
      description: 'Remove a series from the Sonarr import exclusion list, allowing it to be re-added.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          exclusionId: { type: 'number', description: 'Exclusion ID (from sonarr_get_import_exclusions)' },
        },
        required: ['exclusionId'],
      },
    },
    {
      name: 'sonarr_trigger_cutoff_unmet_search',
      description: 'Trigger a search for all monitored episodes that have a file but have not met the quality cutoff (upgrade candidates).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_trigger_refresh_monitored_downloads',
      description: 'Trigger Sonarr to refresh its view of monitored downloads — useful for checking stalled or stuck downloads.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_trigger_rss_sync',
      description: 'Trigger an immediate RSS feed sync across all configured indexers in Sonarr.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_season_pass',
      description: 'Bulk set monitored status for entire seasons across one or more series.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesId: { type: 'number', description: 'Series ID to update' },
          seasons: {
            type: 'array',
            description: 'Season numbers and their monitored state',
            items: {
              type: 'object',
              properties: {
                seasonNumber: { type: 'number', description: 'Season number (0 = specials)' },
                monitored: { type: 'boolean', description: 'Monitor this season' },
              },
              required: ['seasonNumber', 'monitored'],
            },
          },
        },
        required: ['seriesId', 'seasons'],
      },
    },
    {
      name: 'sonarr_search_releases',
      description: 'Search indexers for available releases for a specific episode. Returns release candidates with quality, size, seeders, and rejection reasons. Use the guid and indexerId from results to grab a release with sonarr_grab_release.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          episodeId: { type: 'number', description: 'Episode ID (from sonarr_get_episodes)' },
        },
        required: ['episodeId'],
      },
    },
    {
      name: 'sonarr_grab_release',
      description: 'Grab a specific release and send it to the download client. Use sonarr_search_releases first to find the guid and indexerId.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          guid: { type: 'string', description: 'Release GUID (from sonarr_search_releases)' },
          indexerId: { type: 'number', description: 'Indexer ID (from sonarr_search_releases)' },
        },
        required: ['guid', 'indexerId'],
      },
    },
    {
      name: 'sonarr_get_command_status',
      description: 'Poll the status of an async command previously triggered (e.g. RescanSeries, RefreshSeries). Pass the commandId returned by the trigger tool.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          commandId: { type: 'number', description: 'Command ID returned by a trigger tool' },
        },
        required: ['commandId'],
      },
    },
    {
      name: 'sonarr_trigger_rescan_series',
      description: 'Rescan disk for all series to link existing files Sonarr does not know about.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sonarr_trigger_rename_series',
      description: 'Rename episode files on disk to match current Sonarr naming settings. Pass specific seriesIds or omit to rename all.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesIds: { type: 'array', items: { type: 'number' }, description: 'Series IDs to rename. Omit for all series.' },
        },
        required: [],
      },
    },
    {
      name: 'sonarr_trigger_downloaded_scan',
      description: 'Force a scan of a completed downloads path to import any files that were not auto-imported. A path is required — pass the absolute path to the completed downloads folder (e.g. /downloads/complete).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'Absolute path to the completed downloads folder to scan (e.g. /downloads/complete)' },
        },
        required: ['path'],
      },
    },
    {
      name: 'sonarr_bulk_update_series',
      description: 'Bulk update multiple Sonarr series at once — change monitored status, quality profile, or tags in a single API call. Use this instead of calling sonarr_update_series in a loop.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesIds: { type: 'array', items: { type: 'number' }, description: 'List of series IDs to update' },
          monitored: { type: 'boolean', description: 'Set monitored status for all specified series' },
          qualityProfileId: { type: 'number', description: 'Change quality profile for all specified series' },
          tags: { type: 'array', items: { type: 'number' }, description: 'Tag IDs to apply' },
          applyTags: { type: 'string', enum: ['add', 'remove', 'replace'], description: 'How to apply tags (default: add)' },
        },
        required: ['seriesIds'],
      },
    },
    {
      name: 'sonarr_bulk_delete_series',
      description: 'Bulk delete multiple series from Sonarr. WARNING: Setting deleteFiles to true is destructive and irreversible — files will be permanently removed from disk.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          seriesIds: { type: 'array', items: { type: 'number' }, description: 'List of series IDs to delete' },
          deleteFiles: { type: 'boolean', description: 'Delete episode files from disk (default: false) — IRREVERSIBLE' },
          addImportListExclusion: { type: 'boolean', description: 'Prevent re-importing these series (default: false)' },
        },
        required: ['seriesIds'],
      },
    },
    {
      name: 'sonarr_get_manual_import',
      description: 'Scan a folder and preview how Sonarr would match each file for manual import. Shows quality, matched series/episode, and any rejection reasons. Use sonarr_process_manual_import to confirm.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          folder: { type: 'string', description: 'Absolute path to the folder to scan' },
          filterExistingFiles: { type: 'boolean', description: 'Only show files not already in the Sonarr library (default: true)' },
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Results per page (default: 50)' },
        },
        required: ['folder'],
      },
    },
    {
      name: 'sonarr_process_manual_import',
      description: 'Confirm and import files identified by sonarr_get_manual_import. Pass the items array from the preview response (optionally filtered to only importable items with no rejections).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          items: { type: 'array', description: 'Items from sonarr_get_manual_import to import (exclude items with rejections)' },
        },
        required: ['items'],
      },
    },
  ],

  handlers: {
    sonarr_get_series: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const limit = clampLimit((args.limit as number | undefined) ?? 25);
      const offset = clampOffset((args.offset as number | undefined) ?? 0);
      const search = (args.search as string | undefined)?.trim().toLowerCase();

      const all = await clients.sonarr.getSeries();
      const filtered = search ? all.filter(s => s.title.toLowerCase().includes(search)) : all;
      const page = filtered.slice(offset, offset + limit);

      return ok({
        ...paginate(
          page.map(s => ({
            id: s.id,
            title: s.title,
            year: s.year,
            status: s.status,
            network: s.network,
            seasons: s.statistics?.seasonCount,
            episodes: `${s.statistics?.episodeFileCount ?? 0}/${s.statistics?.totalEpisodeCount ?? 0}`,
            sizeOnDisk: formatBytes(s.statistics?.sizeOnDisk ?? 0),
            monitored: s.monitored,
            qualityProfileId: s.qualityProfileId,
          })),
          filtered.length,
          offset,
          limit
        ),
        ...(search ? { search } : {}),
        totalLibrary: all.length,
      });
    },

    sonarr_search: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const term = args.term as string;
      const results = await clients.sonarr.searchSeries(term);
      return ok({
        count: results.length,
        results: results.slice(0, 10).map(r => ({
          title: r.title,
          year: r.year,
          tvdbId: r.tvdbId,
          status: r.status,
          overview: truncate(r.overview, 200),
        })),
      });
    },

    sonarr_get_queue: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const limit = clampLimit((args.limit as number | undefined) ?? 10);
      const queue = await clients.sonarr.getQueue();
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

    sonarr_get_calendar: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const days = (args.days as number | undefined) ?? 7;
      const calendar = await clients.sonarr.getCalendar(today(), daysFromNow(days));
      const items = calendar as Array<Record<string, unknown>>;
      return ok({
        days,
        count: items.length,
        episodes: items.map(e => ({
          id: e['id'],
          seriesId: e['seriesId'],
          seriesTitle: e['series'] ? (e['series'] as Record<string, unknown>)['title'] : undefined,
          seasonNumber: e['seasonNumber'],
          episodeNumber: e['episodeNumber'],
          title: e['title'],
          airDate: e['airDate'],
          hasFile: e['hasFile'],
        })),
      });
    },

    sonarr_get_episodes: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const seriesId = args.seriesId as number;
      const seasonNumber = args.seasonNumber as number | undefined;
      const episodes = await clients.sonarr.getEpisodes(seriesId, seasonNumber);
      return ok({
        count: episodes.length,
        episodes: episodes.map(e => ({
          id: e.id,
          seasonNumber: e.seasonNumber,
          episodeNumber: e.episodeNumber,
          title: e.title,
          airDate: e.airDate,
          hasFile: e.hasFile,
          monitored: e.monitored,
        })),
      });
    },

    sonarr_search_missing: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const seriesId = args.seriesId as number;
      const result = await clients.sonarr.searchMissing(seriesId);
      return ok({ success: true, message: 'Search triggered for missing episodes', commandId: result.id });
    },

    sonarr_search_episode: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const episodeIds = args.episodeIds as number[];
      const result = await clients.sonarr.searchEpisode(episodeIds);
      return ok({
        success: true,
        message: `Search triggered for ${episodeIds.length} episode(s)`,
        commandId: result.id,
      });
    },

    sonarr_refresh_series: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const seriesId = args.seriesId as number | undefined;
      if (seriesId !== undefined) {
        const [series, result] = await Promise.all([
          clients.sonarr.getSeriesById(seriesId),
          clients.sonarr.refreshSeries(seriesId),
        ]);
        return ok({
          success: true,
          message: 'Metadata refresh triggered',
          series: { id: series.id, title: series.title, year: series.year },
          commandId: result.id,
        });
      }
      const result = await clients.sonarr.refreshSeries();
      return ok({ success: true, message: 'Metadata refresh triggered for all series', commandId: result.id });
    },

    sonarr_add_series: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { tvdbId, title, qualityProfileId, rootFolderPath, monitored, seasonFolder, tags } =
        args as {
          tvdbId: number;
          title: string;
          qualityProfileId: number;
          rootFolderPath: string;
          monitored?: boolean;
          seasonFolder?: boolean;
          tags?: number[];
        };
      const added = await clients.sonarr.addSeries({
        tvdbId,
        title,
        qualityProfileId,
        rootFolderPath,
        monitored,
        seasonFolder,
        tags: tags ?? [],
      });
      return ok({
        success: true,
        message: `Added "${added.title}" (${added.year}) to Sonarr`,
        id: added.id,
        path: added.path,
        monitored: added.monitored,
      });
    },

    sonarr_delete_series: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { seriesId, deleteFiles = false, addImportListExclusion = false } = args as {
        seriesId: number;
        deleteFiles?: boolean;
        addImportListExclusion?: boolean;
      };
      const series = await clients.sonarr.getSeriesById(seriesId);
      await clients.sonarr.deleteSeries(seriesId, deleteFiles, addImportListExclusion);
      return ok({
        success: true,
        message: `Removed "${series.title}" (${series.year}) from Sonarr`,
        deletedFiles: deleteFiles,
        addedToExclusions: addImportListExclusion,
      });
    },

    sonarr_update_series: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { seriesId, monitored, qualityProfileId, seasonFolder, tags } = args as {
        seriesId: number;
        monitored?: boolean;
        qualityProfileId?: number;
        seasonFolder?: boolean;
        tags?: number[];
      };
      const changes: Record<string, unknown> = {};
      if (monitored !== undefined) changes['monitored'] = monitored;
      if (qualityProfileId !== undefined) changes['qualityProfileId'] = qualityProfileId;
      if (seasonFolder !== undefined) changes['seasonFolder'] = seasonFolder;
      if (tags !== undefined) changes['tags'] = tags;
      const updated = await clients.sonarr.updateSeries(seriesId, changes);
      return ok({
        success: true,
        message: `Updated "${updated.title}" (${updated.year})`,
        id: updated.id,
        monitored: updated.monitored,
        qualityProfileId: updated.qualityProfileId,
        seasonFolder: updated.seasonFolder,
        tags: updated.tags,
      });
    },

    sonarr_get_disk_space: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const diskSpace = await clients.sonarr.getDiskSpace();
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

    sonarr_get_history: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { seriesId, page = 1, pageSize = 20 } = args as {
        seriesId?: number;
        page?: number;
        pageSize?: number;
      };
      const history = await clients.sonarr.getHistory(seriesId, page, clampLimit(pageSize));
      const isArray = Array.isArray(history);
      const records = isArray
        ? (history as unknown as Array<Record<string, unknown>>)
        : ((history as unknown as { records: Array<Record<string, unknown>>; totalRecords: number }).records);
      const total = isArray ? records.length : (history as unknown as { totalRecords: number }).totalRecords;
      return ok({
        totalRecords: total,
        returned: records.length,
        ...(seriesId ? { seriesId } : {}),
        records: records.map(r => ({
          id: r['id'],
          seriesId: r['seriesId'],
          episodeId: r['episodeId'],
          sourceTitle: r['sourceTitle'],
          eventType: r['eventType'],
          date: r['date'],
          quality: (r['quality'] as Record<string, unknown> | undefined)?.['quality'],
          languages: r['languages'],
          downloadId: r['downloadId'],
        })),
      });
    },

    sonarr_remove_from_queue: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { ids, blocklist = false, removeFromClient = true } = args as {
        ids: number[];
        blocklist?: boolean;
        removeFromClient?: boolean;
      };
      if (ids.length === 1) {
        await clients.sonarr.removeFromQueue(ids[0], blocklist, removeFromClient);
      } else {
        await clients.sonarr.removeFromQueueBulk(ids, blocklist, removeFromClient);
      }
      return ok({
        success: true,
        message: `Removed ${ids.length} item(s) from queue`,
        ids,
        blocklisted: blocklist,
        removedFromClient: removeFromClient,
      });
    },

    sonarr_get_wanted_missing: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { page = 1, pageSize = 20 } = args as { page?: number; pageSize?: number };
      const wanted = await clients.sonarr.getWantedMissing(page, clampLimit(pageSize));
      return ok({
        totalRecords: wanted.totalRecords,
        page: wanted.page,
        pageSize: wanted.pageSize,
        returned: wanted.records.length,
        hasMore: wanted.page * wanted.pageSize < wanted.totalRecords,
        series: wanted.records.map(s => ({
          id: s.id,
          title: s.title,
          year: s.year,
          status: s.status,
          monitored: s.monitored,
          qualityProfileId: s.qualityProfileId,
          seasons: s.statistics?.seasonCount,
          missingEpisodes: (s.statistics?.episodeCount ?? 0) - (s.statistics?.episodeFileCount ?? 0),
        })),
      });
    },

    sonarr_get_wanted_cutoff: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { page = 1, pageSize = 20 } = args as { page?: number; pageSize?: number };
      const wanted = await clients.sonarr.getWantedCutoff(page, clampLimit(pageSize));
      return ok({
        totalRecords: wanted.totalRecords,
        page: wanted.page,
        pageSize: wanted.pageSize,
        returned: wanted.records.length,
        hasMore: wanted.page * wanted.pageSize < wanted.totalRecords,
        series: wanted.records.map(s => ({
          id: s.id,
          title: s.title,
          year: s.year,
          monitored: s.monitored,
          qualityProfileId: s.qualityProfileId,
          sizeOnDisk: formatBytes(s.statistics?.sizeOnDisk ?? 0),
          episodes: `${s.statistics?.episodeFileCount ?? 0}/${s.statistics?.totalEpisodeCount ?? 0}`,
        })),
      });
    },

    sonarr_get_episode_files: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { seriesId, seasonNumber } = args as { seriesId: number; seasonNumber?: number };
      const files = await clients.sonarr.getEpisodeFiles(seriesId);
      const filtered = seasonNumber !== undefined ? files.filter(f => f.seasonNumber === seasonNumber) : files;
      return ok({
        count: filtered.length,
        totalSize: formatBytes(filtered.reduce((sum, f) => sum + f.size, 0)),
        files: filtered.map(f => ({
          id: f.id,
          seasonNumber: f.seasonNumber,
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
          dynamicRange: f.mediaInfo?.videoDynamicRangeType || undefined,
        })),
      });
    },

    sonarr_delete_episode_file: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const fileId = args.fileId as number;
      await clients.sonarr.deleteEpisodeFile(fileId);
      return ok({ success: true, message: `Deleted episode file ${fileId} from disk` });
    },

    sonarr_delete_episode_files_bulk: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { fileIds, seriesId, seasonNumber } = args as { fileIds?: number[]; seriesId?: number; seasonNumber?: number };
      if (!fileIds && seriesId === undefined) throw new Error('Provide fileIds or seriesId');
      let ids: number[];
      if (fileIds && fileIds.length > 0) {
        ids = fileIds;
      } else {
        const files = await clients.sonarr.getEpisodeFiles(Number(seriesId));
        ids = seasonNumber !== undefined
          ? files.filter(f => f.seasonNumber === seasonNumber).map(f => f.id)
          : files.map(f => f.id);
      }
      if (ids.length === 0) return ok({ success: true, deleted: 0, message: 'No files found to delete' });
      await clients.sonarr.deleteEpisodeFiles(ids);
      return ok({ success: true, deleted: ids.length, message: `Deleted ${ids.length} episode file${ids.length === 1 ? '' : 's'}` });
    },

    sonarr_get_blocklist: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { page = 1, pageSize = 20 } = args as { page?: number; pageSize?: number };
      const blocklist = await clients.sonarr.getBlocklist(page, clampLimit(pageSize));
      const records = Array.isArray(blocklist)
        ? (blocklist as unknown as SeriesBlocklistRecord[])
        : (blocklist as { records: SeriesBlocklistRecord[]; totalRecords: number }).records;
      const total = Array.isArray(blocklist)
        ? records.length
        : (blocklist as { totalRecords: number }).totalRecords;
      return ok({
        totalRecords: total,
        returned: records.length,
        entries: records.map(b => ({
          id: b.id,
          seriesId: b.seriesId,
          episodeIds: b.episodeIds,
          sourceTitle: b.sourceTitle,
          quality: b.quality?.quality?.name,
          date: b.date,
          protocol: b.protocol,
          indexer: b.indexer,
          message: b.message,
        })),
      });
    },

    sonarr_delete_from_blocklist: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const blocklistId = args.blocklistId as number;
      await clients.sonarr.deleteFromBlocklist(blocklistId);
      return ok({ success: true, message: `Removed blocklist entry ${blocklistId}` });
    },

    sonarr_monitor_episodes: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { episodeIds, monitored } = args as { episodeIds: number[]; monitored: boolean };
      await clients.sonarr.monitorEpisodes(episodeIds, monitored);
      return ok({
        success: true,
        message: `${monitored ? 'Monitoring' : 'Unmonitoring'} ${episodeIds.length} episode(s)`,
        episodeIds,
        monitored,
      });
    },

    sonarr_get_quality_profile: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const profileId = args.profileId as number;
      const profile = await clients.sonarr.getQualityProfile(profileId);
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

    sonarr_update_quality_profile: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { profileId, upgradeAllowed, cutoff, minFormatScore, cutoffFormatScore, formatScores } = args as {
        profileId: number;
        upgradeAllowed?: boolean;
        cutoff?: number;
        minFormatScore?: number;
        cutoffFormatScore?: number;
        formatScores?: Array<{ formatId: number; score: number }>;
      };
      const existing: QualityProfile = await clients.sonarr.getQualityProfile(profileId);
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
      const updated = await clients.sonarr.updateQualityProfile(profileId, existing);
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

    sonarr_list_custom_formats: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const formats = await clients.sonarr.getCustomFormats();
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

    sonarr_get_custom_format: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const formatId = args.formatId as number;
      const f = await clients.sonarr.getCustomFormat(formatId);
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

    sonarr_create_custom_format: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { name, includeWhenRenaming, specifications } = args as {
        name: string;
        includeWhenRenaming?: boolean;
        specifications: Array<{ name: string; implementation: string; negate: boolean; required: boolean; fields: Array<{ name: string; value: unknown }> }>;
      };
      const created = await clients.sonarr.createCustomFormat({
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

    sonarr_update_custom_format: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { formatId, name, includeWhenRenaming, specifications } = args as {
        formatId: number;
        name?: string;
        includeWhenRenaming?: boolean;
        specifications?: Array<{ name: string; implementation: string; negate: boolean; required: boolean; fields: Array<{ name: string; value: unknown }> }>;
      };
      const existing = await clients.sonarr.getCustomFormat(formatId);
      if (name !== undefined) existing.name = name;
      if (includeWhenRenaming !== undefined) existing.includeCustomFormatWhenRenaming = includeWhenRenaming;
      if (specifications !== undefined) existing.specifications = specifications;
      const updated = await clients.sonarr.updateCustomFormat(formatId, existing);
      return ok({
        success: true,
        message: `Updated custom format "${updated.name}"`,
        id: updated.id,
        name: updated.name,
      });
    },

    sonarr_delete_custom_format: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const formatId = args.formatId as number;
      await clients.sonarr.deleteCustomFormat(formatId);
      return ok({ success: true, message: `Deleted custom format ${formatId}` });
    },

    sonarr_get_system_tasks: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const tasks = await clients.sonarr.getSystemTasks();
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

    sonarr_get_logs: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = Math.min((args.pageSize as number | undefined) ?? 20, 100);
      const level = args.level as string | undefined;
      const result = await clients.sonarr.getLogs(page, pageSize, level);
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

    sonarr_trigger_backup: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const result = await clients.sonarr.triggerBackup();
      return ok({ success: true, message: 'Backup triggered', commandId: result.id });
    },

    sonarr_get_notifications: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const notifications = await clients.sonarr.getNotifications();
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

    sonarr_update_quality_definition: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { definitionId, minSize, maxSize, preferredSize } = args as {
        definitionId: number;
        minSize?: number;
        maxSize?: number;
        preferredSize?: number;
      };
      const definitions = await clients.sonarr.getQualityDefinitions();
      const existing = definitions.find(d => d.id === definitionId);
      if (!existing) return { content: [{ type: 'text' as const, text: JSON.stringify({ isError: true, message: `Quality definition ${definitionId} not found` }) }], isError: true };
      if (minSize !== undefined) existing.minSize = minSize;
      if (maxSize !== undefined) existing.maxSize = maxSize;
      if (preferredSize !== undefined) existing.preferredSize = preferredSize;
      const updated = await clients.sonarr.updateQualityDefinition(definitionId, existing);
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

    sonarr_get_import_lists: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const lists = await clients.sonarr.getImportLists();
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

    sonarr_update_import_list: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { listId, enabled, enableAuto } = args as {
        listId: number;
        enabled?: boolean;
        enableAuto?: boolean;
      };
      const lists = await clients.sonarr.getImportLists();
      const existing = lists.find(l => l.id === listId);
      if (!existing) return { content: [{ type: 'text' as const, text: JSON.stringify({ isError: true, message: `Import list ${listId} not found` }) }], isError: true };
      if (enabled !== undefined) existing.enabled = enabled;
      if (enableAuto !== undefined) existing.enableAuto = enableAuto;
      const updated = await clients.sonarr.updateImportList(listId, existing);
      return ok({
        success: true,
        message: `Updated import list "${updated.name}"`,
        id: updated.id,
        name: updated.name,
        enabled: updated.enabled,
        enableAuto: updated.enableAuto,
      });
    },

    sonarr_create_tag: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const label = args.label as string;
      const tag = await clients.sonarr.createTag(label);
      return ok({ success: true, message: `Created tag "${tag.label}"`, id: tag.id, label: tag.label });
    },

    sonarr_delete_tag: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const tagId = args.tagId as number;
      await clients.sonarr.deleteTag(tagId);
      return ok({ success: true, message: `Deleted tag ${tagId}` });
    },

    sonarr_get_import_exclusions: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const exclusions = await clients.sonarr.getImportExclusions();
      return ok({
        count: exclusions.length,
        exclusions: exclusions.map(e => ({ id: e.id, title: e.title, tvdbId: e.tvdbId, year: e.year })),
      });
    },

    sonarr_delete_import_exclusion: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const exclusionId = args.exclusionId as number;
      await clients.sonarr.deleteImportExclusion(exclusionId);
      return ok({ success: true, message: `Removed exclusion ${exclusionId} — series can now be re-added` });
    },

    sonarr_trigger_cutoff_unmet_search: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const result = await clients.sonarr.runCommand('CutoffUnmetEpisodeSearch');
      return ok({ success: true, message: 'Triggered cutoff-unmet episode search', commandId: result.id });
    },

    sonarr_trigger_refresh_monitored_downloads: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const result = await clients.sonarr.runCommand('RefreshMonitoredDownloads');
      return ok({ success: true, message: 'Triggered refresh of monitored downloads', commandId: result.id });
    },

    sonarr_trigger_rss_sync: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const result = await clients.sonarr.runCommand('RssSync');
      return ok({ success: true, message: 'Triggered RSS sync', commandId: result.id });
    },

    sonarr_season_pass: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { seriesId, seasons } = args as {
        seriesId: number;
        seasons: Array<{ seasonNumber: number; monitored: boolean }>;
      };
      const series = await clients.sonarr.getSeriesById(seriesId);
      await clients.sonarr.setSeasonPass([{
        id: seriesId,
        monitored: series.monitored,
        seasons,
      }]);
      return ok({
        success: true,
        message: `Updated season monitoring for "${series.title}"`,
        seriesId,
        seasons,
      });
    },

    sonarr_search_releases: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const episodeId = args.episodeId as number;
      const releases = await clients.sonarr.searchReleases(episodeId);
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

    sonarr_grab_release: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const guid = args.guid as string;
      const indexerId = args.indexerId as number;
      const result = await clients.sonarr.grabRelease(guid, indexerId);
      return ok({
        success: true,
        message: `Grabbed release "${result.title}"`,
        title: result.title,
        quality: result.quality?.quality?.name,
        indexer: result.indexer,
        size: formatBytes(result.size),
      });
    },

    sonarr_get_command_status: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const commandId = args.commandId as number;
      const result = await clients.sonarr.getCommandStatus(commandId);
      return ok({ id: result.id, name: result.name, status: result.status, message: result.message, started: result.started, ended: result.ended });
    },

    sonarr_trigger_rescan_series: async (_args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const result = await clients.sonarr.rescanAllSeries();
      return ok({ success: true, message: 'Rescan triggered for all series', commandId: result.id });
    },

    sonarr_trigger_rename_series: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const seriesIds = (args.seriesIds as number[] | undefined) ?? [];
      const result = await clients.sonarr.runCommand('RenameSeries', { seriesIds });
      return ok({ success: true, message: seriesIds.length > 0 ? `Rename triggered for ${seriesIds.length} series` : 'Rename triggered for all series', commandId: result.id });
    },

    sonarr_trigger_downloaded_scan: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const path = args.path as string;
      const result = await clients.sonarr.runCommand('DownloadedEpisodesScan', { path });
      return ok({ success: true, message: `Triggered scan of ${path}`, commandId: result.id });
    },

    sonarr_bulk_update_series: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { seriesIds, monitored, qualityProfileId, tags, applyTags } = args as {
        seriesIds: number[];
        monitored?: boolean;
        qualityProfileId?: number;
        tags?: number[];
        applyTags?: 'add' | 'remove' | 'replace';
      };
      await clients.sonarr.bulkUpdateSeries(seriesIds, { monitored, qualityProfileId, tags, applyTags });
      return ok({ success: true, message: `Updated ${seriesIds.length} series`, seriesIds });
    },

    sonarr_bulk_delete_series: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const { seriesIds, deleteFiles = false, addImportListExclusion = false } = args as {
        seriesIds: number[];
        deleteFiles?: boolean;
        addImportListExclusion?: boolean;
      };
      await clients.sonarr.bulkDeleteSeries(seriesIds, deleteFiles, addImportListExclusion);
      return ok({ success: true, message: `Deleted ${seriesIds.length} series`, deletedFiles: deleteFiles, addedToExclusions: addImportListExclusion });
    },

    sonarr_get_manual_import: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const folder = args.folder as string;
      const filterExistingFiles = (args.filterExistingFiles as boolean | undefined) ?? true;
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = (args.pageSize as number | undefined) ?? 50;
      const items = await clients.sonarr.getManualImport(folder, filterExistingFiles, page, pageSize);
      return ok({
        count: items.length,
        items: items.map(i => ({
          id: i.id,
          path: i.path,
          relativePath: i.relativePath,
          series: i.series,
          seasonNumber: i.seasonNumber,
          episodes: i.episodes,
          quality: i.quality,
          size: formatBytes(i.size),
          rejections: i.rejections,
        })),
      });
    },

    sonarr_process_manual_import: async (args, clients) => {
      if (!clients.sonarr) throw new Error('Sonarr is not configured');
      const items = args.items as import('../clients/arr-client.js').ManualImportItem[];
      await clients.sonarr.processManualImport(items);
      return ok({ success: true, message: `Submitted ${items.length} items for import` });
    },
  },
};
