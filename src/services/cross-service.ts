/**
 * Cross-service tools: arr_status and arr_search_all
 *
 * These tools operate across all configured services simultaneously.
 */

import type { ToolModule } from '../types.js';
import { ok } from '../types.js';
import { truncate } from '../shared/formatting.js';

export const crossServiceModule: ToolModule = {
  tools: [
    {
      name: 'arr_status',
      description:
        'Get connection status and version info for all configured *arr services. Use this to verify which services are running and reachable.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'arr_search_all',
      description:
        'Search across all configured *arr services simultaneously. Returns top 5 results per service. Useful for finding whether something is already tracked in any service. Use the "type" filter to narrow to a specific media type.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          term: { type: 'string', description: 'Search term (title, artist name, etc.)' },
          type: {
            type: 'string',
            enum: ['tv', 'movies', 'music'],
            description: 'Limit search to a specific media type. Omit to search all configured services.',
          },
        },
        required: ['term'],
      },
    },
  ],

  handlers: {
    arr_status: async (_args, clients) => {
      const results: Record<string, unknown> = {};

      for (const [name, client] of Object.entries(clients) as Array<[string, { getStatus: () => Promise<{ version: string; appName: string }> } | undefined]>) {
        if (!client) continue;
        try {
          const status = await client.getStatus();
          results[name] = {
            configured: true,
            connected: true,
            version: status.version,
            appName: status.appName,
          };
        } catch (error) {
          results[name] = {
            configured: true,
            connected: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      return ok(results);
    },

    arr_search_all: async (args, clients) => {
      const term = args.term as string;
      const type = args.type as 'tv' | 'movies' | 'music' | undefined;
      const results: Record<string, unknown> = {};

      if (clients.sonarr && (type === undefined || type === 'tv')) {
        try {
          const hits = await clients.sonarr.searchSeries(term);
          results['sonarr'] = {
            count: hits.length,
            results: hits.slice(0, 5).map(r => ({
              title: r.title,
              year: r.year,
              tvdbId: r.tvdbId,
              status: r.status,
              overview: truncate(r.overview, 150),
            })),
          };
        } catch (e) {
          results['sonarr'] = { error: e instanceof Error ? e.message : String(e) };
        }
      }

      if (clients.radarr && (type === undefined || type === 'movies')) {
        try {
          const hits = await clients.radarr.searchMovies(term);
          results['radarr'] = {
            count: hits.length,
            results: hits.slice(0, 5).map(r => ({
              title: r.title,
              year: r.year,
              tmdbId: r.tmdbId,
              imdbId: r.imdbId,
              status: r.status,
              overview: truncate(r.overview, 150),
            })),
          };
        } catch (e) {
          results['radarr'] = { error: e instanceof Error ? e.message : String(e) };
        }
      }

      if (clients.lidarr && (type === undefined || type === 'music')) {
        try {
          const hits = await clients.lidarr.searchArtists(term);
          results['lidarr'] = {
            count: hits.length,
            results: hits.slice(0, 5).map(r => ({
              artistName: r.artistName ?? r.title,
              disambiguation: r.disambiguation,
              foreignArtistId: r.foreignArtistId,
              overview: truncate(r.overview, 150),
            })),
          };
        } catch (e) {
          results['lidarr'] = { error: e instanceof Error ? e.message : String(e) };
        }
      }

      return ok({ term, type: type ?? 'all', results });
    },
  },
};
