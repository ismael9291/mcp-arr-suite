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
      description: 'Search across all Prowlarr indexers.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          term: { type: 'string', description: 'Search term' },
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
      const results = await clients.prowlarr.search(query);
      const items = results as Array<Record<string, unknown>>;
      return ok({
        count: items.length,
        results: items.slice(0, 25).map(r => ({
          title: r['title'],
          indexer: r['indexer'],
          size: r['size'],
          seeders: r['seeders'],
          leechers: r['leechers'],
          publishDate: r['publishDate'],
          downloadUrl: r['downloadUrl'],
        })),
        note: items.length > 25 ? `Showing first 25 of ${items.length} results` : undefined,
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
  },
};
