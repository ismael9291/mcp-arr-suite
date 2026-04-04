/**
 * Shared config tool factory.
 *
 * Generates the 7 standard configuration tools (health, quality_profiles,
 * root_folders, download_clients, naming, tags, review_setup) for any
 * configurable service in a single call.
 *
 * To add a new configurable service: just call buildConfigModule('myapp', 'MyApp')
 * and register the result — no other files need to change.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ClientMap, HandlerFn, ToolModule, ToolResult } from '../types.js';
import { ok, err } from '../types.js';
import { formatBytes } from './formatting.js';
import type { ArrClient } from '../clients/arr-client.js';

type ConfigurableService = 'sonarr' | 'radarr' | 'lidarr';

function getClient(serviceName: ConfigurableService, clients: ClientMap): ArrClient {
  const client = clients[serviceName];
  if (!client) throw new Error(`${serviceName} is not configured`);
  return client as ArrClient;
}

export function buildConfigModule(
  serviceName: ConfigurableService,
  displayName: string
): ToolModule {
  const tools: Tool[] = [
    {
      name: `${serviceName}_get_quality_profiles`,
      description: `Get quality profiles from ${displayName}. Shows allowed qualities, upgrade settings, and custom format scores.`,
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: `${serviceName}_get_health`,
      description: `Get health check warnings from ${displayName}. Shows any problems the application has detected.`,
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: `${serviceName}_get_root_folders`,
      description: `Get root folders and free space from ${displayName}. Use this to find valid rootFolderPath values when adding media.`,
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: `${serviceName}_get_download_clients`,
      description: `Get download client configurations from ${displayName}.`,
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: `${serviceName}_get_naming`,
      description: `Get file and folder naming configuration from ${displayName}.`,
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: `${serviceName}_get_tags`,
      description: `Get all tags defined in ${displayName}. Use tag IDs when adding media.`,
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: `${serviceName}_review_setup`,
      description: `Comprehensive configuration review for ${displayName}. Returns quality profiles, download clients, naming, storage, indexers, and health in one call. Use this to analyse the setup and suggest improvements.`,
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
  ];

  const handlers: Record<string, HandlerFn> = {
    [`${serviceName}_get_quality_profiles`]: async (_args, clients) => {
      const client = getClient(serviceName, clients);
      const profiles = await client.getQualityProfiles();
      return ok({
        count: profiles.length,
        profiles: profiles.map(p => ({
          id: p.id,
          name: p.name,
          upgradeAllowed: p.upgradeAllowed,
          cutoff: p.cutoff,
          allowedQualities: p.items
            .filter(i => i.allowed)
            .map(i => i.quality?.name ?? i.name ?? i.items?.map(q => q.quality.name).join(', '))
            .filter(Boolean),
          customFormats: p.formatItems?.filter(f => f.score !== 0).map(f => ({
            name: f.name,
            score: f.score,
          })) ?? [],
          minFormatScore: p.minFormatScore,
          cutoffFormatScore: p.cutoffFormatScore,
        })),
      });
    },

    [`${serviceName}_get_health`]: async (_args, clients) => {
      const client = getClient(serviceName, clients);
      const health = await client.getHealth();
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

    [`${serviceName}_get_root_folders`]: async (_args, clients) => {
      const client = getClient(serviceName, clients);
      const folders = await client.getRootFolders();
      return ok({
        count: folders.length,
        folders: folders.map(f => ({
          id: f.id,
          path: f.path,
          accessible: f.accessible,
          freeSpace: formatBytes(f.freeSpace),
          freeSpaceBytes: f.freeSpace,
          unmappedFolders: f.unmappedFolders?.length ?? 0,
        })),
      });
    },

    [`${serviceName}_get_download_clients`]: async (_args, clients) => {
      const client = getClient(serviceName, clients);
      const downloadClients = await client.getDownloadClients();
      return ok({
        count: downloadClients.length,
        clients: downloadClients.map(c => ({
          id: c.id,
          name: c.name,
          implementation: c.implementationName,
          protocol: c.protocol,
          enabled: c.enable,
          priority: c.priority,
          removeCompletedDownloads: c.removeCompletedDownloads,
          removeFailedDownloads: c.removeFailedDownloads,
          tags: c.tags,
        })),
      });
    },

    [`${serviceName}_get_naming`]: async (_args, clients) => {
      const client = getClient(serviceName, clients);
      const naming = await client.getNamingConfig();
      return ok(naming);
    },

    [`${serviceName}_get_tags`]: async (_args, clients) => {
      const client = getClient(serviceName, clients);
      const tags = await client.getTags();
      return ok({
        count: tags.length,
        tags: tags.map(t => ({ id: t.id, label: t.label })),
      });
    },

    [`${serviceName}_review_setup`]: async (_args, clients): Promise<ToolResult> => {
      const client = getClient(serviceName, clients);

      const [status, health, qualityProfiles, qualityDefinitions, downloadClients, naming, mediaManagement, rootFolders, tags, indexers] =
        await Promise.all([
          client.getStatus(),
          client.getHealth(),
          client.getQualityProfiles(),
          client.getQualityDefinitions(),
          client.getDownloadClients(),
          client.getNamingConfig(),
          client.getMediaManagement(),
          client.getRootFolders(),
          client.getTags(),
          client.getIndexers(),
        ]);

      // Lidarr-specific: fetch metadata profiles
      let metadataProfiles = null;
      if (serviceName === 'lidarr' && clients.lidarr) {
        metadataProfiles = await clients.lidarr.getMetadataProfiles();
      }

      return ok({
        service: serviceName,
        version: status.version,
        appName: status.appName,
        platform: { os: status.osName, isDocker: status.isDocker },
        health: { status: health.length === 0 ? 'healthy' : 'issues detected', issueCount: health.length, issues: health },
        storage: {
          rootFolders: rootFolders.map(f => ({
            path: f.path,
            accessible: f.accessible,
            freeSpace: formatBytes(f.freeSpace),
            freeSpaceBytes: f.freeSpace,
            unmappedFolderCount: f.unmappedFolders?.length ?? 0,
          })),
        },
        qualityProfiles: qualityProfiles.map(p => ({
          id: p.id,
          name: p.name,
          upgradeAllowed: p.upgradeAllowed,
          cutoff: p.cutoff,
          allowedQualities: p.items
            .filter(i => i.allowed)
            .map(i => i.quality?.name ?? i.name ?? i.items?.map(q => q.quality.name).join(', '))
            .filter(Boolean),
          customFormatsWithScores: p.formatItems?.filter(f => f.score !== 0).length ?? 0,
          minFormatScore: p.minFormatScore,
        })),
        qualityDefinitions: qualityDefinitions.map(d => ({
          quality: d.quality.name,
          minSize: `${d.minSize} MB/min`,
          maxSize: (d.maxSize == null || d.maxSize === 0) ? 'unlimited' : `${d.maxSize} MB/min`,
          preferredSize: (d.preferredSize == null || d.preferredSize === 0) ? 'unlimited' : `${d.preferredSize} MB/min`,
        })),
        downloadClients: downloadClients.map(c => ({
          name: c.name,
          type: c.implementationName,
          protocol: c.protocol,
          enabled: c.enable,
          priority: c.priority,
        })),
        indexers: indexers.map(i => ({
          name: i.name,
          protocol: i.protocol,
          enableRss: i.enableRss,
          enableAutomaticSearch: i.enableAutomaticSearch,
          enableInteractiveSearch: i.enableInteractiveSearch,
          priority: i.priority,
        })),
        naming,
        mediaManagement: {
          recycleBin: mediaManagement.recycleBin || 'not set',
          recycleBinCleanupDays: mediaManagement.recycleBinCleanupDays,
          downloadPropersAndRepacks: mediaManagement.downloadPropersAndRepacks,
          deleteEmptyFolders: mediaManagement.deleteEmptyFolders,
          copyUsingHardlinks: mediaManagement.copyUsingHardlinks,
          importExtraFiles: mediaManagement.importExtraFiles,
          extraFileExtensions: mediaManagement.extraFileExtensions,
        },
        tags: tags.map(t => t.label),
        ...(metadataProfiles && { metadataProfiles }),
      });
    },
  };

  return { tools, handlers };
}
