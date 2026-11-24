/**
 * Maintainerr ToolModule
 *
 * Covers: Settings, Plex library/collection management, Rules, and Collections.
 * Tool definitions and handlers live together.
 *
 * Known quirks (from API discovery):
 * - POST /api/settings requires the FULL settings object — always GET first, merge, then POST.
 * - Rule creation returns HTTP 201 but can silently fail if Plex is unreachable — verify with get_rule_count.
 * - Date values in rule conditions are in seconds (30 days = 2592000).
 */

import type { ToolModule } from '../types.js';
import { ok, err } from '../types.js';

export const maintainerrModule: ToolModule = {
  tools: [
    // ── Settings ─────────────────────────────────────────────────────────────

    {
      name: 'maintainerr_get_settings',
      description: 'Get all Maintainerr settings including Plex, Overseerr, Radarr, Sonarr, Tautulli, and cron schedules.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_update_settings',
      description:
        'Update Maintainerr settings. IMPORTANT: This endpoint requires the full settings object — partial updates silently fail on some fields. Always call maintainerr_get_settings first, merge your changes, and pass the full merged object.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          settings: {
            type: 'object',
            description: 'Full settings object (id, plex_name, plex_hostname, plex_port, plex_ssl, plex_auth_token, overseerr_url, overseerr_api_key, collection_handler_job_cron, rules_handler_job_cron, etc.)',
          },
        },
        required: ['settings'],
      },
    },
    {
      name: 'maintainerr_get_version',
      description: 'Get the running Maintainerr version.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_check_setup',
      description: 'Check if Maintainerr is fully configured. Returns true if setup is complete, false otherwise.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_test_plex',
      description: 'Test the Plex connection currently configured in Maintainerr settings.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_test_overseerr',
      description: 'Test an Overseerr connection from Maintainerr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'Overseerr URL (e.g. http://overseerr:5055)' },
          api_key: { type: 'string', description: 'Overseerr API key' },
        },
        required: ['url', 'api_key'],
      },
    },
    {
      name: 'maintainerr_test_sonarr',
      description: 'Test a Sonarr connection from Maintainerr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          serverName: { type: 'string', description: 'Display name for this Sonarr instance' },
          url: { type: 'string', description: 'Sonarr URL (e.g. http://sonarr:8989)' },
          apiKey: { type: 'string', description: 'Sonarr API key' },
        },
        required: ['serverName', 'url', 'apiKey'],
      },
    },
    {
      name: 'maintainerr_test_radarr',
      description: 'Test a Radarr connection from Maintainerr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          serverName: { type: 'string', description: 'Display name for this Radarr instance' },
          url: { type: 'string', description: 'Radarr URL (e.g. http://radarr:7878)' },
          apiKey: { type: 'string', description: 'Radarr API key' },
        },
        required: ['serverName', 'url', 'apiKey'],
      },
    },
    {
      name: 'maintainerr_test_tautulli',
      description: 'Test a Tautulli connection from Maintainerr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'Tautulli URL (e.g. http://tautulli:8181)' },
          api_key: { type: 'string', description: 'Tautulli API key' },
        },
        required: ['url', 'api_key'],
      },
    },
    {
      name: 'maintainerr_test_jellyseerr',
      description: 'Test a Jellyseerr connection from Maintainerr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'Jellyseerr URL (e.g. http://jellyseerr:5055)' },
          api_key: { type: 'string', description: 'Jellyseerr API key' },
        },
        required: ['url', 'api_key'],
      },
    },
    {
      name: 'maintainerr_get_plex_servers',
      description: 'List Plex servers available for the configured Plex token. Requires Plex token to be set first.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_set_plex_token',
      description: 'Set the Plex auth token in Maintainerr. Triggers the plex.tv auth flow.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          token: { type: 'string', description: 'Plex auth token' },
        },
        required: ['token'],
      },
    },
    {
      name: 'maintainerr_validate_cron',
      description: 'Validate a cron expression against Maintainerr\'s cron parser.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          cron: { type: 'string', description: 'Cron expression to validate (e.g. "0 0-23/12 * * *")' },
        },
        required: ['cron'],
      },
    },

    // ── Plex ─────────────────────────────────────────────────────────────────

    {
      name: 'maintainerr_get_plex_libraries',
      description: 'List all Plex libraries visible to Maintainerr. Returns key (library ID), type (movie/show), and title for each library.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_get_library_content',
      description: 'Get paginated content from a Plex library. Pass minYear/maxYear to scan every page and return a compact { ratingKey, title, year } list of matches instead.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          libraryId: { type: 'string', description: 'Plex library key (from maintainerr_get_plex_libraries)' },
          page: { type: 'number', description: 'Page number (default: 1). Ignored when minYear/maxYear is set.' },
          minYear: { type: 'number', description: 'Only include items released in or after this year' },
          maxYear: { type: 'number', description: 'Only include items released in or before this year' },
        },
        required: ['libraryId'],
      },
    },
    {
      name: 'maintainerr_search_library',
      description: 'Search for media within a specific Plex library.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          libraryId: { type: 'string', description: 'Plex library key (from maintainerr_get_plex_libraries)' },
          query: { type: 'string', description: 'Search query' },
        },
        required: ['libraryId', 'query'],
      },
    },
    {
      name: 'maintainerr_search_plex',
      description: 'Search across all Plex libraries.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
    {
      name: 'maintainerr_get_library_collections',
      description: 'List all Plex collections in a specific library.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          libraryId: { type: 'string', description: 'Plex library key (from maintainerr_get_plex_libraries)' },
        },
        required: ['libraryId'],
      },
    },
    {
      name: 'maintainerr_get_plex_collection',
      description: 'Get details of a specific Plex collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'string', description: 'Plex collection ID' },
        },
        required: ['collectionId'],
      },
    },
    {
      name: 'maintainerr_get_plex_collection_children',
      description: 'Get the media items (children) inside a Plex collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'string', description: 'Plex collection ID' },
        },
        required: ['collectionId'],
      },
    },
    {
      name: 'maintainerr_get_media_metadata',
      description: 'Get Plex metadata for a specific media item.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          plexId: { type: 'number', description: 'Plex media ID (ratingKey)' },
        },
        required: ['plexId'],
      },
    },
    {
      name: 'maintainerr_get_media_seen',
      description: 'Get seen-by (watch history) info for a Plex media item.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          plexId: { type: 'number', description: 'Plex media ID (ratingKey)' },
        },
        required: ['plexId'],
      },
    },
    {
      name: 'maintainerr_get_media_children',
      description: 'Get children (seasons/episodes) of a Plex media item.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          plexId: { type: 'number', description: 'Plex media ID (ratingKey)' },
        },
        required: ['plexId'],
      },
    },
    {
      name: 'maintainerr_get_plex_users',
      description: 'List all Plex users visible to Maintainerr.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_create_plex_collection',
      description: 'Create a new Plex collection in a library.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          libraryId: { type: 'string', description: 'Plex library key (from maintainerr_get_plex_libraries)' },
          title: { type: 'string', description: 'Collection title' },
          type: { type: 'number', description: 'Collection type: 1=movie, 2=show' },
        },
        required: ['libraryId', 'title', 'type'],
      },
    },
    {
      name: 'maintainerr_update_plex_collection_settings',
      description: 'Update visibility settings for a Plex collection (recommended, home screen visibility).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'string', description: 'Plex collection ID' },
          libraryId: { type: 'string', description: 'Plex library key' },
          recommended: { type: 'boolean', description: 'Show as recommended' },
          ownHome: { type: 'boolean', description: 'Show on owner home screen' },
          sharedHome: { type: 'boolean', description: 'Show on shared users home screens' },
        },
        required: ['collectionId', 'libraryId'],
      },
    },
    {
      name: 'maintainerr_add_to_plex_collection',
      description: 'Add a media item to a Plex collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'string', description: 'Plex collection ID' },
          childId: { type: 'string', description: 'Plex ID of the media to add' },
        },
        required: ['collectionId', 'childId'],
      },
    },
    {
      name: 'maintainerr_remove_from_plex_collection',
      description: 'Remove a media item from a Plex collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'string', description: 'Plex collection ID' },
          childId: { type: 'string', description: 'Plex ID of the media to remove' },
        },
        required: ['collectionId', 'childId'],
      },
    },
    {
      name: 'maintainerr_delete_plex_collection',
      description: 'Delete a Plex collection. This removes the collection from Plex but does not delete the underlying media files.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'string', description: 'Plex collection ID' },
        },
        required: ['collectionId'],
      },
    },

    // ── Rules ─────────────────────────────────────────────────────────────────

    {
      name: 'maintainerr_get_rule_constants',
      description:
        'Get all available rule constants: application IDs, property IDs with human names and types, and operator/action enums. Essential reference before creating or editing rules. Application IDs: 0=Plex, 1=Radarr, 2=Sonarr, 3=Overseerr, 4=Tautulli, 5=Jellyseerr.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_get_rules',
      description: 'Get all Maintainerr rule groups.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_get_rule_count',
      description: 'Get the total number of Maintainerr rule groups. Useful to verify rule creation succeeded (creation can silently fail).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_get_rule',
      description: 'Get details of a specific rule group by ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Rule group ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_create_rule',
      description:
        'Create a new Maintainerr rule group and its associated Plex collection. Use maintainerr_get_rule_constants to look up app/property IDs. Rule conditions use firstVal=[appId, propId], action (comparison operator), and customVal or lastVal. Date values are in seconds (30 days=2592000, 60 days=5184000). Returns HTTP 201 even on silent failure — verify with maintainerr_get_rule_count.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Rule group name' },
          description: { type: 'string', description: 'Description' },
          libraryId: { type: 'number', description: 'Plex library ID (key from maintainerr_get_plex_libraries)' },
          dataType: {
            type: 'number',
            description: 'Media type: 1=movies, 2=shows, 3=seasons, 4=episodes',
          },
          isActive: { type: 'boolean', description: 'Whether the rule group is active (default: true)' },
          arrAction: {
            type: 'number',
            description: 'Action to take in *arr: 0=no action, higher values add deletion actions',
          },
          useRules: { type: 'boolean', description: 'Use rule conditions to populate collection (default: true)' },
          listExclusions: { type: 'boolean', description: 'Add exclusions to *arr import lists (default: true)' },
          forceOverseerr: { type: 'boolean', description: 'Force Overseerr deletion (default: false)' },
          manualCollection: { type: 'boolean', description: 'Manual collection mode — no auto-population (default: false)' },
          deleteAfterDays: { type: 'number', description: 'Days before collection media is acted on (0 = immediately)' },
          rules: {
            type: 'array',
            description: 'Rule conditions. Each: { firstVal: [appId, propId], action: <RulePossibility>, customVal: { ruleTypeId: 0|3, value: "<string>" }, operator: null|"0"|"1", section: 0 }',
            items: { type: 'object' },
          },
        },
        required: ['name', 'libraryId', 'dataType'],
      },
    },
    {
      name: 'maintainerr_update_rule',
      description: 'Update an existing rule group. Only pass the fields to change: the current group (rules, collection settings, Radarr/Sonarr links) is fetched and merged so nothing else is reset. Rules are condition objects ({ operator, action, firstVal, customVal, section }).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Rule group ID to update' },
          name: { type: 'string', description: 'Rule group name' },
          description: { type: 'string', description: 'Description' },
          isActive: { type: 'boolean', description: 'Active state' },
          arrAction: { type: 'number', description: 'Action in *arr' },
          deleteAfterDays: { type: 'number', description: 'Days before acting on collection media' },
          listExclusions: { type: 'boolean', description: 'Add to *arr import list exclusions' },
          forceOverseerr: { type: 'boolean', description: 'Force Overseerr deletion' },
          tautulliWatchedPercentOverride: {
            type: ['number', 'null'],
            description: 'Percent played at which Tautulli conditions count an item as watched (null = Tautulli\'s own watched flag)',
          },
          rules: {
            type: 'array',
            description: 'Updated rule conditions array',
            items: { type: 'object' },
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_delete_rule',
      description: 'Delete a Maintainerr rule group and its associated Plex collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Rule group ID to delete' },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_execute_rules',
      description: 'Manually trigger the rules handler to run all active rules immediately.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_stop_rules',
      description: 'Stop a currently running rules handler execution.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_test_rule',
      description:
        'Test a saved rule group against specific Plex media items without changing anything. Returns whether each item would match, plus the per-condition results.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          rulegroupId: { type: 'number', description: 'Rule group ID (from maintainerr_get_rules)' },
          mediaId: { type: 'number', description: 'Plex media ID (ratingKey) to test' },
          mediaIds: { type: 'array', items: { type: 'number' }, description: 'Multiple Plex media IDs to test' },
        },
        required: ['rulegroupId'],
      },
    },
    {
      name: 'maintainerr_add_exclusion',
      description: 'Add manual exclusions for Plex media items. Omit ruleGroupId for a global exclusion that applies to every rule (including future ones). Excluded items will not be acted on.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          plexId: { type: 'number', description: 'Plex media ID (ratingKey)' },
          plexIds: { type: 'array', items: { type: 'number' }, description: 'Multiple Plex media IDs to exclude in one call' },
          ruleGroupId: { type: 'number', description: 'Rule group ID to exclude from (omit for all rules)' },
        },
        required: [],
      },
    },
    {
      name: 'maintainerr_get_exclusions',
      description: 'Get all manually added rule exclusions.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_delete_exclusion',
      description: 'Remove a specific exclusion by its ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Exclusion ID (from maintainerr_get_exclusions)' },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_delete_media_exclusions',
      description: 'Remove all rule exclusions (global and per-rule, including child seasons/episodes) for Plex media items.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          plexId: { type: 'number', description: 'Plex media ID (ratingKey)' },
          plexIds: { type: 'array', items: { type: 'number' }, description: 'Multiple Plex media IDs in one call' },
        },
        required: [],
      },
    },
    {
      name: 'maintainerr_get_community_rules',
      description: 'Browse community-shared rule templates from the Maintainerr community.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: { type: 'number', description: 'Page number (default: 1)' },
          limit: { type: 'number', description: 'Results per page (default: 10)' },
          typeId: { type: 'number', description: 'Media type filter: 1=movies, 2=shows (default: 1)' },
        },
        required: [],
      },
    },
    {
      name: 'maintainerr_update_rules_schedule',
      description: 'Update the cron schedule for the rules handler job.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          cron: { type: 'string', description: 'Cron expression (e.g. "0 0-23/8 * * *" for every 8 hours)' },
        },
        required: ['cron'],
      },
    },

    // ── Collections ───────────────────────────────────────────────────────────

    {
      name: 'maintainerr_get_collections',
      description: 'Get all Maintainerr managed collections with their current state, rule associations, and deletion settings.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_get_collection',
      description: 'Get details of a specific Maintainerr collection by ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Collection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_update_collection',
      description: 'Update a Maintainerr collection — change title, deleteAfterDays, or arrAction.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Collection ID' },
          title: { type: 'string', description: 'New collection title' },
          deleteAfterDays: { type: 'number', description: 'Days to wait before acting on media in the collection (0 = immediately)' },
          arrAction: { type: 'number', description: 'Action to perform in Radarr/Sonarr' },
          isActive: { type: 'boolean', description: 'Active state' },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_trigger_collection_handler',
      description: 'Manually trigger the collection handler to process all active collections immediately (apply deletions, update Plex).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'maintainerr_activate_collection',
      description: 'Activate a Maintainerr collection so it is processed on schedule.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Collection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_deactivate_collection',
      description: 'Deactivate a Maintainerr collection to pause processing without deleting it.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Collection ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_get_collection_media',
      description: 'Get all media currently in a Maintainerr collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'number', description: 'Collection ID' },
        },
        required: ['collectionId'],
      },
    },
    {
      name: 'maintainerr_get_collection_media_count',
      description: 'Get the number of media items in a Maintainerr collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'number', description: 'Collection ID' },
        },
        required: ['collectionId'],
      },
    },
    {
      name: 'maintainerr_add_to_collection',
      description: 'Manually add a Plex media item to a Maintainerr collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'number', description: 'Collection ID' },
          plexId: { type: 'number', description: 'Plex media ID (ratingKey)' },
        },
        required: ['collectionId', 'plexId'],
      },
    },
    {
      name: 'maintainerr_remove_from_collection',
      description: 'Remove a Plex media item from a Maintainerr collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          collectionId: { type: 'number', description: 'Collection ID' },
          plexId: { type: 'number', description: 'Plex media ID (ratingKey)' },
        },
        required: ['collectionId', 'plexId'],
      },
    },
    {
      name: 'maintainerr_get_collection_logs',
      description: 'Get paginated action logs for a Maintainerr collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Collection ID' },
          page: { type: 'number', description: 'Page number (default: 1)' },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_get_collection_exclusions',
      description: 'Get paginated exclusions for a Maintainerr collection.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'number', description: 'Collection ID' },
          page: { type: 'number', description: 'Page number (default: 1)' },
        },
        required: ['id'],
      },
    },
    {
      name: 'maintainerr_update_collections_schedule',
      description: 'Update the cron schedule for the collection handler job.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          cron: { type: 'string', description: 'Cron expression (e.g. "0 0-23/12 * * *" for every 12 hours)' },
        },
        required: ['cron'],
      },
    },
  ],

  handlers: {
    // ── Settings ───────────────────────────────────────────────────────────────

    maintainerr_get_settings: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getSettings());
    },

    maintainerr_update_settings: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      const settings = args.settings as Record<string, unknown>;
      return ok(await clients.maintainerr.updateSettings(settings));
    },

    maintainerr_get_version: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getVersion());
    },

    maintainerr_check_setup: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok({ configured: await clients.maintainerr.checkSetup() });
    },

    maintainerr_test_plex: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.testPlex());
    },

    maintainerr_test_overseerr: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.testOverseerr(args.url as string, args.api_key as string));
    },

    maintainerr_test_sonarr: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.testSonarr(args.serverName as string, args.url as string, args.apiKey as string));
    },

    maintainerr_test_radarr: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.testRadarr(args.serverName as string, args.url as string, args.apiKey as string));
    },

    maintainerr_test_tautulli: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.testTautulli(args.url as string, args.api_key as string));
    },

    maintainerr_test_jellyseerr: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.testJellyseerr(args.url as string, args.api_key as string));
    },

    maintainerr_get_plex_servers: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getPlexServers());
    },

    maintainerr_set_plex_token: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.setPlexToken(args.token as string));
    },

    maintainerr_validate_cron: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.validateCron(args.cron as string));
    },

    // ── Plex ──────────────────────────────────────────────────────────────────

    maintainerr_get_plex_libraries: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getPlexLibraries());
    },

    maintainerr_get_library_content: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      const minYear = args.minYear as number | undefined;
      const maxYear = args.maxYear as number | undefined;
      if (minYear === undefined && maxYear === undefined) {
        return ok(await clients.maintainerr.getLibraryContent(
          args.libraryId as string,
          (args.page as number | undefined) ?? 1
        ));
      }

      type PlexItem = { ratingKey: string; title: string; year?: number };
      const all: PlexItem[] = [];
      for (let page = 1; ; page++) {
        const res = await clients.maintainerr.getLibraryContent(args.libraryId as string, page) as
          { totalSize?: number; items?: PlexItem[] };
        const items = res?.items ?? [];
        all.push(...items);
        if (items.length === 0 || all.length >= (res?.totalSize ?? 0)) break;
      }
      const matches = all
        .filter(i => i.year !== undefined &&
          (minYear === undefined || i.year >= minYear) &&
          (maxYear === undefined || i.year <= maxYear))
        .map(i => ({ ratingKey: Number(i.ratingKey), title: i.title, year: i.year }));
      return ok({
        libraryTotal: all.length,
        count: matches.length,
        noYear: all.filter(i => i.year === undefined).map(i => i.title),
        items: matches,
      });
    },

    maintainerr_search_library: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.searchLibrary(args.libraryId as string, args.query as string));
    },

    maintainerr_search_plex: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.searchPlex(args.query as string));
    },

    maintainerr_get_library_collections: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getLibraryCollections(args.libraryId as string));
    },

    maintainerr_get_plex_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getPlexCollectionDetails(args.collectionId as string));
    },

    maintainerr_get_plex_collection_children: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getPlexCollectionChildren(args.collectionId as string));
    },

    maintainerr_get_media_metadata: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getMediaMetadata(args.plexId as number));
    },

    maintainerr_get_media_seen: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getMediaSeen(args.plexId as number));
    },

    maintainerr_get_media_children: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getMediaChildren(args.plexId as number));
    },

    maintainerr_get_plex_users: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getPlexUsers());
    },

    maintainerr_create_plex_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.createPlexCollection(
        args.libraryId as string,
        args.title as string,
        args.type as number
      ));
    },

    maintainerr_update_plex_collection_settings: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.updatePlexCollectionSettings(
        args.collectionId as string,
        args.libraryId as string,
        {
          recommended: args.recommended as boolean | undefined,
          ownHome: args.ownHome as boolean | undefined,
          sharedHome: args.sharedHome as boolean | undefined,
        }
      ));
    },

    maintainerr_add_to_plex_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.addToPlexCollection(args.collectionId as string, args.childId as string));
    },

    maintainerr_remove_from_plex_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.removeFromPlexCollection(args.collectionId as string, args.childId as string));
    },

    maintainerr_delete_plex_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      await clients.maintainerr.deletePlexCollection(args.collectionId as string);
      return ok({ deleted: true, collectionId: args.collectionId });
    },

    // ── Rules ─────────────────────────────────────────────────────────────────

    maintainerr_get_rule_constants: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getRuleConstants());
    },

    maintainerr_get_rules: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getRules());
    },

    maintainerr_get_rule_count: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok({ count: await clients.maintainerr.getRuleCount() });
    },

    maintainerr_get_rule: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getRule(args.id as number));
    },

    maintainerr_create_rule: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      const payload: Record<string, unknown> = {
        name: args.name,
        description: args.description ?? '',
        libraryId: args.libraryId,
        dataType: args.dataType,
        isActive: (args.isActive as boolean | undefined) ?? true,
        arrAction: (args.arrAction as number | undefined) ?? 0,
        useRules: (args.useRules as boolean | undefined) ?? true,
        listExclusions: (args.listExclusions as boolean | undefined) ?? true,
        forceOverseerr: (args.forceOverseerr as boolean | undefined) ?? false,
        manualCollection: (args.manualCollection as boolean | undefined) ?? false,
        rules: (args.rules as unknown[]) ?? [],
      };
      if (args.deleteAfterDays !== undefined) payload.deleteAfterDays = args.deleteAfterDays;
      return ok(await clients.maintainerr.createRule(payload));
    },

    maintainerr_update_rule: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      type RuleRow = { ruleJson: string };
      type Group = Record<string, unknown> & {
        id: number; rules?: RuleRow[]; collection?: Record<string, unknown>; notifications?: unknown[];
      };
      const groups = await clients.maintainerr.getRules() as Group[];
      const current = groups.find(g => g.id === args.id);
      if (!current) return err(`Rule group ${args.id} not found.`);
      const col = current.collection ?? {};

      // Maintainerr's PUT /rules replaces the whole group, so start from the full current state.
      const payload: Record<string, unknown> = {
        id: current.id,
        libraryId: current.libraryId,
        name: current.name,
        description: current.description,
        isActive: current.isActive,
        useRules: current.useRules,
        dataType: current.dataType,
        arrAction: col.arrAction,
        listExclusions: col.listExclusions,
        forceOverseerr: col.forceOverseerr,
        tautulliWatchedPercentOverride: col.tautulliWatchedPercentOverride,
        radarrSettingsId: col.radarrSettingsId,
        sonarrSettingsId: col.sonarrSettingsId,
        notifications: current.notifications,
        collection: {
          visibleOnRecommended: col.visibleOnRecommended,
          visibleOnHome: col.visibleOnHome,
          deleteAfterDays: col.deleteAfterDays,
          manualCollection: col.manualCollection,
          manualCollectionName: col.manualCollectionName,
          keepLogsForMonths: col.keepLogsForMonths,
        },
        rules: (current.rules ?? []).map(r => JSON.parse(r.ruleJson)),
      };
      for (const key of ['name', 'description', 'isActive', 'arrAction', 'listExclusions', 'forceOverseerr', 'tautulliWatchedPercentOverride', 'rules']) {
        if (args[key] !== undefined) payload[key] = args[key];
      }
      if (args.deleteAfterDays !== undefined) {
        (payload.collection as Record<string, unknown>).deleteAfterDays = args.deleteAfterDays;
      }
      const result = await clients.maintainerr.updateRule(payload) as { code?: number; result?: string } | undefined;
      if (!result || result.code !== 1) return err(`Maintainerr rejected the update: ${JSON.stringify(result)}`);
      return ok(result);
    },

    maintainerr_delete_rule: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      await clients.maintainerr.deleteRule(args.id as number);
      return ok({ deleted: true, id: args.id });
    },

    maintainerr_execute_rules: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.executeRules());
    },

    maintainerr_stop_rules: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.stopRules());
    },

    maintainerr_test_rule: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      const ids = [
        ...((args.mediaIds as number[] | undefined) ?? []),
        ...(args.mediaId !== undefined ? [args.mediaId as number] : []),
      ];
      if (ids.length === 0) return err('Provide mediaId or mediaIds.');
      type Stat = { plexId: number; result: boolean; sectionResults?: unknown[] };
      const results = [];
      for (const id of ids) {
        const res = await clients.maintainerr.testRule(args.rulegroupId as number, id) as
          { code?: number; result?: Stat[] | string };
        if (res?.code !== 1 || !Array.isArray(res.result)) {
          results.push({ mediaId: id, error: res?.result ?? 'No result' });
          continue;
        }
        const stat = res.result[0];
        results.push({ mediaId: id, matches: stat?.result ?? false, sectionResults: stat?.sectionResults });
      }
      return ok({ rulegroupId: args.rulegroupId, results });
    },

    maintainerr_add_exclusion: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      const ids = [
        ...((args.plexIds as number[] | undefined) ?? []),
        ...(args.plexId !== undefined ? [args.plexId as number] : []),
      ];
      if (ids.length === 0) return err('Provide plexId or plexIds.');
      const ruleGroupId = args.ruleGroupId as number | undefined;
      const failed: { plexId: number; error: string }[] = [];
      for (const id of ids) {
        try {
          await clients.maintainerr.addExclusion(id, ruleGroupId);
        } catch (e) {
          failed.push({ plexId: id, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return ok({
        scope: ruleGroupId === undefined ? 'global' : `ruleGroup ${ruleGroupId}`,
        added: ids.length - failed.length,
        failed,
      });
    },

    maintainerr_get_exclusions: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getExclusions());
    },

    maintainerr_delete_exclusion: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      await clients.maintainerr.deleteExclusion(args.id as number);
      return ok({ deleted: true, id: args.id });
    },

    maintainerr_delete_media_exclusions: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      const ids = [
        ...((args.plexIds as number[] | undefined) ?? []),
        ...(args.plexId !== undefined ? [args.plexId as number] : []),
      ];
      if (ids.length === 0) return err('Provide plexId or plexIds.');
      const failed: { plexId: number; error: string }[] = [];
      for (const id of ids) {
        try {
          await clients.maintainerr.deleteExclusionsForMedia(id);
        } catch (e) {
          failed.push({ plexId: id, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return ok({ deleted: ids.length - failed.length, failed });
    },

    maintainerr_get_community_rules: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getCommunityRules(
        (args.page as number | undefined) ?? 1,
        (args.limit as number | undefined) ?? 10,
        (args.typeId as number | undefined) ?? 1
      ));
    },

    maintainerr_update_rules_schedule: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.updateRulesSchedule(args.cron as string));
    },

    // ── Collections ────────────────────────────────────────────────────────────

    maintainerr_get_collections: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getCollections());
    },

    maintainerr_get_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getCollection(args.id as number));
    },

    maintainerr_update_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      const payload: Record<string, unknown> = { id: args.id };
      if (args.title !== undefined) payload.title = args.title;
      if (args.deleteAfterDays !== undefined) payload.deleteAfterDays = args.deleteAfterDays;
      if (args.arrAction !== undefined) payload.arrAction = args.arrAction;
      if (args.isActive !== undefined) payload.isActive = args.isActive;
      return ok(await clients.maintainerr.updateCollection(payload));
    },

    maintainerr_trigger_collection_handler: async (_args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.triggerCollectionHandler());
    },

    maintainerr_activate_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.activateCollection(args.id as number));
    },

    maintainerr_deactivate_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.deactivateCollection(args.id as number));
    },

    maintainerr_get_collection_media: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getCollectionMedia(args.collectionId as number));
    },

    maintainerr_get_collection_media_count: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok({ count: await clients.maintainerr.getCollectionMediaCount(args.collectionId as number) });
    },

    maintainerr_add_to_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.addToCollection(args.collectionId as number, args.plexId as number));
    },

    maintainerr_remove_from_collection: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.removeFromCollection(args.collectionId as number, args.plexId as number));
    },

    maintainerr_get_collection_logs: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getCollectionLogs(args.id as number, (args.page as number | undefined) ?? 1));
    },

    maintainerr_get_collection_exclusions: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.getCollectionExclusions(args.id as number, (args.page as number | undefined) ?? 1));
    },

    maintainerr_update_collections_schedule: async (args, clients) => {
      if (!clients.maintainerr) return err('Maintainerr is not configured. Set MAINTAINERR_URL.');
      return ok(await clients.maintainerr.updateCollectionsSchedule(args.cron as string));
    },
  },
};
