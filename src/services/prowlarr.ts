/**
 * Prowlarr (Indexer Management) ToolModule
 *
 * Prowlarr has a different config structure — it does not use the standard
 * naming/media-management config, so it skips buildConfigModule and defines
 * all its tools here directly.
 */

import type { ToolModule } from '../types.js';
import { ok } from '../types.js';

export const prowlarrModule: ToolModule = {
  tools: [
    {
      name: 'prowlarr_get_indexers',
      description: 'Get all configured indexers in Prowlarr.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'prowlarr_search',
      description: 'Search across all Prowlarr indexers. Supports category filtering and pagination.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          term: { type: 'string', description: 'Search term' },
          categories: {
            type: 'array',
            items: { type: 'number' },
            description: 'Newznab category IDs to filter by (e.g. 2000=Movies, 5000=TV, 3000=Audio). Omit for all categories.',
          },
          offset: { type: 'number', description: 'Result offset for pagination (default: 0)' },
          limit: { type: 'number', description: 'Max results to return (default: 25)' },
        },
        required: ['term'],
      },
    },
    {
      name: 'prowlarr_test_indexers',
      description: 'Test all indexers and return their health status.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'prowlarr_get_stats',
      description: 'Get indexer statistics: queries, grabs, failures, and average response times.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'prowlarr_get_health',
      description: 'Get health check warnings from Prowlarr.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'prowlarr_get_history',
      description: 'Get Prowlarr search/grab history, optionally filtered by indexer.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: { type: 'number', description: 'Page number (default: 1)' },
          pageSize: { type: 'number', description: 'Results per page (default: 20)' },
          indexerId: { type: 'number', description: 'Filter history to a specific indexer ID' },
        },
        required: [],
      },
    },
    {
      name: 'prowlarr_get_tags',
      description: 'Get all tags defined in Prowlarr.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'prowlarr_create_tag',
      description: 'Create a new tag in Prowlarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          label: { type: 'string', description: 'Tag label' },
        },
        required: ['label'],
      },
    },
    {
      name: 'prowlarr_delete_tag',
      description: 'Delete a tag from Prowlarr.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          tagId: { type: 'number', description: 'Tag ID (from prowlarr_get_tags)' },
        },
        required: ['tagId'],
      },
    },
    {
      name: 'prowlarr_get_download_clients',
      description: 'Get all download clients configured in Prowlarr.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'prowlarr_get_apps',
      description: 'Get all applications connected to Prowlarr (e.g. Sonarr, Radarr) and their sync status.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'prowlarr_get_logs',
      description: 'Fetch recent application log entries from Prowlarr.',
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
      name: 'prowlarr_get_system_tasks',
      description: 'List all scheduled system tasks in Prowlarr with last/next execution times.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'prowlarr_get_command_status',
      description: 'Check the status of an async command triggered in Prowlarr (e.g. from prowlarr_trigger_backup).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          commandId: { type: 'number', description: 'Command ID returned by the triggering tool' },
        },
        required: ['commandId'],
      },
    },
    {
      name: 'prowlarr_trigger_backup',
      description: 'Create an on-demand backup of Prowlarr configuration and database.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'prowlarr_get_notifications',
      description: 'List all configured notification providers in Prowlarr.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
  ],

  handlers: {
    prowlarr_get_indexers: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const indexers = await clients.prowlarr.getIndexers();
      return ok({
        count: indexers.length,
        indexers: indexers.map(i => ({
          id: i.id,
          name: i.name,
          protocol: i.protocol,
          enableRss: i.enableRss,
          enableAutomaticSearch: i.enableAutomaticSearch,
          enableInteractiveSearch: i.enableInteractiveSearch,
          priority: i.priority,
        })),
      });
    },

    prowlarr_search: async (args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const query = args.term as string;
      const categories = args.categories as number[] | undefined;
      const offset = (args.offset as number | undefined) ?? 0;
      const limit = (args.limit as number | undefined) ?? 25;
      const results = await clients.prowlarr.search(query, categories);
      const items = results as Array<Record<string, unknown>>;
      const page = items.slice(offset, offset + limit);
      return ok({
        totalResults: items.length,
        returned: page.length,
        offset,
        limit,
        hasMore: offset + page.length < items.length,
        results: page.map(r => ({
          title: r['title'],
          indexer: r['indexer'],
          size: r['size'],
          seeders: r['seeders'],
          leechers: r['leechers'],
          publishDate: r['publishDate'],
          downloadUrl: r['downloadUrl'],
          categories: r['categories'],
        })),
      });
    },

    prowlarr_test_indexers: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const [results, indexers] = await Promise.all([
        clients.prowlarr.testAllIndexers(),
        clients.prowlarr.getIndexers(),
      ]);
      const indexerMap = new Map(indexers.map(i => [i.id, i.name]));
      return ok({
        count: results.length,
        healthy: results.filter(r => r.isValid).length,
        failed: results.filter(r => !r.isValid).length,
        indexers: results.map(r => ({
          id: r.id,
          name: indexerMap.get(r.id) ?? 'Unknown',
          isValid: r.isValid,
          errors: r.validationFailures.map(f => f.errorMessage),
        })),
      });
    },

    prowlarr_get_stats: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const stats = await clients.prowlarr.getIndexerStats();
      return ok({
        count: stats.indexers.length,
        totals: {
          queries: stats.indexers.reduce((s, i) => s + i.numberOfQueries, 0),
          grabs: stats.indexers.reduce((s, i) => s + i.numberOfGrabs, 0),
          failedQueries: stats.indexers.reduce((s, i) => s + i.numberOfFailedQueries, 0),
          failedGrabs: stats.indexers.reduce((s, i) => s + i.numberOfFailedGrabs, 0),
        },
        indexers: stats.indexers.map(s => ({
          name: s.indexerName,
          queries: s.numberOfQueries,
          grabs: s.numberOfGrabs,
          failedQueries: s.numberOfFailedQueries,
          failedGrabs: s.numberOfFailedGrabs,
          avgResponseTime: `${s.averageResponseTime}ms`,
        })),
      });
    },

    prowlarr_get_health: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const health = await clients.prowlarr.getHealth();
      return ok({
        status: health.length === 0 ? 'healthy' : 'issues detected',
        issueCount: health.length,
        issues: health.map(h => ({
          source: h.source,
          type: h.type,
          message: h.message,
          wikiUrl: h.wikiUrl,
        })),
      });
    },

    prowlarr_get_history: async (args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = (args.pageSize as number | undefined) ?? 20;
      const indexerId = args.indexerId as number | undefined;
      const result = await clients.prowlarr.getHistory(page, pageSize, indexerId);
      return ok({
        page,
        pageSize,
        totalRecords: result.totalRecords,
        records: result.records.map(r => ({
          id: r.id,
          indexer: r.indexer,
          date: r.date,
          eventType: r.eventType,
          successful: r.successful,
          sourceTitle: r.sourceTitle,
          downloadId: r.downloadId,
        })),
      });
    },

    prowlarr_get_tags: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const tags = await clients.prowlarr.getTags();
      return ok({ count: tags.length, tags });
    },

    prowlarr_create_tag: async (args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const label = args.label as string;
      const tag = await clients.prowlarr.createTag(label);
      return ok({ success: true, message: `Created tag "${tag.label}"`, id: tag.id });
    },

    prowlarr_delete_tag: async (args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const tagId = args.tagId as number;
      await clients.prowlarr.deleteTag(tagId);
      return ok({ success: true, message: `Deleted tag ${tagId}` });
    },

    prowlarr_get_download_clients: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const clients_ = await clients.prowlarr.getDownloadClients();
      return ok({
        count: clients_.length,
        downloadClients: clients_.map(c => ({
          id: c.id,
          name: c.name,
          implementation: c.implementationName,
          protocol: c.protocol,
          enable: c.enable,
          priority: c.priority,
          tags: c.tags,
        })),
      });
    },

    prowlarr_get_apps: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const apps = await clients.prowlarr.getApplications();
      return ok({
        count: apps.length,
        applications: apps.map(a => ({
          id: a.id,
          name: a.name,
          implementation: a.implementationName,
          syncLevel: a.syncLevel,
          enable: a.enable,
          tags: a.tags,
        })),
      });
    },

    prowlarr_get_logs: async (args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const page = (args.page as number | undefined) ?? 1;
      const pageSize = Math.min((args.pageSize as number | undefined) ?? 20, 100);
      const level = args.level as string | undefined;
      const result = await clients.prowlarr.getLogs(page, pageSize, level);
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

    prowlarr_get_system_tasks: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const tasks = await clients.prowlarr.getSystemTasks();
      return ok({
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          name: t.name,
          taskName: t.taskName,
          lastExecution: t.lastExecution,
          nextExecution: t.nextExecution,
          isRunning: t.isRunning,
          lastDuration: t.lastDuration,
        })),
      });
    },

    prowlarr_get_command_status: async (args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const commandId = args.commandId as number;
      const result = await clients.prowlarr.getCommandStatus(commandId);
      return ok(result);
    },

    prowlarr_trigger_backup: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const result = await clients.prowlarr.triggerBackup();
      return ok({ success: true, message: 'Backup triggered', commandId: result.id });
    },

    prowlarr_get_notifications: async (_args, clients) => {
      if (!clients.prowlarr) throw new Error('Prowlarr is not configured');
      const notifications = await clients.prowlarr.getNotifications();
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
            onHealthIssue: n.onHealthIssue,
            onApplicationUpdate: n.onApplicationUpdate,
          },
        })),
      });
    },

  },
};
