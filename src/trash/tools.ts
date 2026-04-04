/**
 * TRaSH Guides ToolModule
 *
 * Tools for fetching and comparing quality profiles, custom formats,
 * and naming conventions from https://trash-guides.info
 *
 * These tools are always available — no *arr service configuration required,
 * except for trash_compare_profile and trash_compare_naming which need the
 * corresponding service to be configured.
 */

import type { ToolModule } from '../types.js';
import { ok, err } from '../types.js';
import { trashClient, type TrashService } from './client.js';

export const trashModule: ToolModule = {
  tools: [
    {
      name: 'trash_list_profiles',
      description:
        'List available TRaSH Guides quality profiles for Radarr or Sonarr. Shows recommended profiles for different use cases (1080p, 4K, Remux, etc.)',
      inputSchema: {
        type: 'object' as const,
        properties: {
          service: {
            type: 'string',
            enum: ['radarr', 'sonarr'],
            description: 'Which service to get profiles for',
          },
        },
        required: ['service'],
      },
    },
    {
      name: 'trash_get_profile',
      description:
        'Get a specific TRaSH Guides quality profile with all custom format scores, quality settings, and implementation details.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          service: {
            type: 'string',
            enum: ['radarr', 'sonarr'],
            description: 'Which service',
          },
          profile: {
            type: 'string',
            description: "Profile name (e.g. 'remux-web-1080p', 'uhd-bluray-web', 'hd-bluray-web')",
          },
        },
        required: ['service', 'profile'],
      },
    },
    {
      name: 'trash_list_custom_formats',
      description:
        'List available TRaSH Guides custom formats. Filter by category: hdr, audio, resolution, source, streaming, anime, unwanted, release, language.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          service: {
            type: 'string',
            enum: ['radarr', 'sonarr'],
            description: 'Which service',
          },
          category: {
            type: 'string',
            description: 'Optional category filter',
          },
        },
        required: ['service'],
      },
    },
    {
      name: 'trash_get_naming',
      description:
        'Get TRaSH Guides recommended naming conventions for your media server (Plex, Emby, Jellyfin, or standard).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          service: {
            type: 'string',
            enum: ['radarr', 'sonarr'],
            description: 'Which service',
          },
          mediaServer: {
            type: 'string',
            enum: ['plex', 'emby', 'jellyfin', 'standard'],
            description: 'Which media server you use',
          },
        },
        required: ['service', 'mediaServer'],
      },
    },
    {
      name: 'trash_get_quality_sizes',
      description:
        'Get TRaSH Guides recommended min/max/preferred file sizes for each quality level.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          service: {
            type: 'string',
            enum: ['radarr', 'sonarr'],
            description: 'Which service',
          },
          type: {
            type: 'string',
            description: "Content type: 'movie' or 'anime' for Radarr; 'series' or 'anime' for Sonarr",
          },
        },
        required: ['service'],
      },
    },
    {
      name: 'trash_compare_profile',
      description:
        'Compare your quality profile against TRaSH Guides recommendations. Shows missing custom formats, scoring differences, and quality settings. Requires the corresponding *arr service to be configured.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          service: {
            type: 'string',
            enum: ['radarr', 'sonarr'],
            description: 'Which service',
          },
          profileId: {
            type: 'number',
            description: 'Your quality profile ID to compare',
          },
          trashProfile: {
            type: 'string',
            description: 'TRaSH profile name to compare against',
          },
        },
        required: ['service', 'profileId', 'trashProfile'],
      },
    },
    {
      name: 'trash_compare_naming',
      description:
        'Compare your naming configuration against TRaSH Guides recommendations. Requires the corresponding *arr service to be configured.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          service: {
            type: 'string',
            enum: ['radarr', 'sonarr'],
            description: 'Which service',
          },
          mediaServer: {
            type: 'string',
            enum: ['plex', 'emby', 'jellyfin', 'standard'],
            description: 'Which media server you use',
          },
        },
        required: ['service', 'mediaServer'],
      },
    },
  ],

  handlers: {
    trash_list_profiles: async (args) => {
      const service = args.service as TrashService;
      const profiles = await trashClient.listProfiles(service);
      return ok({
        service,
        count: profiles.length,
        profiles: profiles.map(p => ({
          slug: p.slug,
          name: p.name,
          description: p.description?.replace(/<br>/g, ' ') ?? 'No description',
        })),
        usage: 'Use trash_get_profile with the slug value to see full details for a specific profile',
      });
    },

    trash_get_profile: async (args) => {
      const { service, profile: profileName } = args as { service: TrashService; profile: string };
      const profile = await trashClient.getProfile(service, profileName);
      if (!profile) {
        return err(`Profile '${profileName}' not found for ${service}. Use trash_list_profiles to see available profiles.`);
      }
      return ok({
        name: profile.name,
        description: profile.trash_description?.replace(/<br>/g, '\n'),
        trash_id: profile.trash_id,
        upgradeAllowed: profile.upgradeAllowed,
        cutoff: profile.cutoff,
        minFormatScore: profile.minFormatScore,
        cutoffFormatScore: profile.cutoffFormatScore,
        language: profile.language,
        qualities: profile.items.map(i => ({
          name: i.name,
          allowed: i.allowed,
          items: i.items,
        })),
        customFormats: Object.entries(profile.formatItems ?? {}).map(([name, trashId]) => ({
          name,
          trash_id: trashId,
        })),
      });
    },

    trash_list_custom_formats: async (args) => {
      const { service, category } = args as { service: TrashService; category?: string };
      const formats = await trashClient.listCustomFormats(service, category);
      return ok({
        service,
        category: category ?? 'all',
        count: formats.length,
        formats: formats.slice(0, 50).map(f => ({
          name: f.name,
          categories: f.categories,
          defaultScore: f.defaultScore,
        })),
        ...(formats.length > 50
          ? { note: `Showing first 50 of ${formats.length}. Use category filter to narrow results.` }
          : {}),
        availableCategories: ['hdr', 'audio', 'resolution', 'source', 'streaming', 'anime', 'unwanted', 'release', 'language'],
      });
    },

    trash_get_naming: async (args) => {
      const { service, mediaServer } = args as { service: TrashService; mediaServer: string };
      const naming = await trashClient.getNaming(service);
      if (!naming) {
        return err(`Could not fetch naming conventions for ${service}`);
      }
      const serverMap: Record<string, { folder: string; file: string }> = {
        plex: { folder: 'plex-imdb', file: 'plex-imdb' },
        emby: { folder: 'emby-imdb', file: 'emby-imdb' },
        jellyfin: { folder: 'jellyfin-imdb', file: 'jellyfin-imdb' },
        standard: { folder: 'default', file: 'standard' },
      };
      const keys = serverMap[mediaServer] ?? serverMap['standard'];

      if (service === 'sonarr') {
        // Sonarr naming JSON uses series/episodes/season instead of folder/file
        const seriesMap = naming.series ?? {};
        const episodeMap = naming.episodes?.standard ?? {};
        const seasonMap = naming.season ?? {};
        return ok({
          service,
          mediaServer,
          recommended: {
            series: seriesMap[keys.folder] ?? seriesMap['default'],
            episode: episodeMap[keys.file] ?? episodeMap['default'],
            season: seasonMap['default'],
          },
          allSeriesOptions: Object.keys(seriesMap),
          allEpisodeOptions: Object.keys(episodeMap),
        });
      }

      const folderMap = naming.folder ?? {};
      const fileMap = naming.file ?? {};
      return ok({
        service,
        mediaServer,
        recommended: {
          folder: folderMap[keys.folder] ?? folderMap['default'],
          file: fileMap[keys.file] ?? fileMap['standard'],
          ...(naming.season ? { season: naming.season[keys.folder] ?? naming.season['default'] } : {}),
          ...(naming.series ? { series: naming.series[keys.folder] ?? naming.series['default'] } : {}),
        },
        allFolderOptions: Object.keys(folderMap),
        allFileOptions: Object.keys(fileMap),
      });
    },

    trash_get_quality_sizes: async (args) => {
      const { service, type } = args as { service: TrashService; type?: string };
      const sizes = await trashClient.getQualitySizes(service, type);
      return ok({
        service,
        type: type ?? 'all',
        profiles: sizes.map(s => ({
          type: s.type,
          qualities: s.qualities.map(q => ({
            quality: q.quality,
            min: `${q.min} MB/min`,
            preferred: q.preferred === 1999 ? 'unlimited' : `${q.preferred} MB/min`,
            max: q.max === 2000 ? 'unlimited' : `${q.max} MB/min`,
          })),
        })),
      });
    },

    trash_compare_profile: async (args, clients) => {
      const { service, profileId, trashProfile } = args as {
        service: TrashService;
        profileId: number;
        trashProfile: string;
      };
      const client = service === 'radarr' ? clients.radarr : clients.sonarr;
      if (!client) {
        return err(`${service} is not configured. Cannot compare profiles.`);
      }

      const [userProfiles, trashProfileData] = await Promise.all([
        client.getQualityProfiles(),
        trashClient.getProfile(service, trashProfile),
      ]);

      const userProfile = userProfiles.find(p => p.id === profileId);
      if (!userProfile) {
        return err(
          `Profile ID ${profileId} not found. Available: ${userProfiles.map(p => `${p.id}: ${p.name}`).join(', ')}`
        );
      }
      if (!trashProfileData) {
        return err(`TRaSH profile '${trashProfile}' not found. Use trash_list_profiles to see available profiles.`);
      }

      const userQualities = new Set<string>(
        userProfile.items
          .filter(i => i.allowed)
          .map(i => i.quality?.name ?? i.name)
          .filter((n): n is string => n !== undefined)
      );
      const trashQualities = new Set<string>(
        trashProfileData.items.filter(i => i.allowed).map(i => i.name)
      );
      const userCFNames = new Set(
        (userProfile.formatItems ?? []).filter(f => f.score !== 0).map(f => f.name)
      );
      const trashCFNames = new Set(Object.keys(trashProfileData.formatItems ?? {}));

      return ok({
        yourProfile: {
          name: userProfile.name,
          id: userProfile.id,
          upgradeAllowed: userProfile.upgradeAllowed,
          cutoff: userProfile.cutoff,
        },
        trashProfile: {
          name: trashProfileData.name,
          upgradeAllowed: trashProfileData.upgradeAllowed,
          cutoff: trashProfileData.cutoff,
        },
        qualityComparison: {
          matching: [...userQualities].filter(q => trashQualities.has(q)),
          missingFromYours: [...trashQualities].filter(q => !userQualities.has(q)),
          extraInYours: [...userQualities].filter(q => !trashQualities.has(q)),
        },
        customFormatComparison: {
          matching: [...userCFNames].filter(cf => trashCFNames.has(cf)),
          missingFromYours: [...trashCFNames].filter(cf => !userCFNames.has(cf)),
          extraInYours: [...userCFNames].filter(cf => !trashCFNames.has(cf)),
        },
        recommendations: [
          ...(([...trashQualities].filter(q => !userQualities.has(q))).length > 0
            ? [`Enable these qualities: ${[...trashQualities].filter(q => !userQualities.has(q)).join(', ')}`]
            : []),
          ...(([...trashCFNames].filter(cf => !userCFNames.has(cf))).length > 0
            ? (() => {
                const missing = [...trashCFNames].filter(cf => !userCFNames.has(cf));
                return [`Add these custom formats: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}`];
              })()
            : []),
          ...(userProfile.upgradeAllowed !== trashProfileData.upgradeAllowed
            ? [`Set upgradeAllowed to ${trashProfileData.upgradeAllowed}`]
            : []),
        ],
      });
    },

    trash_compare_naming: async (args, clients) => {
      const { service, mediaServer } = args as { service: TrashService; mediaServer: string };
      const client = service === 'radarr' ? clients.radarr : clients.sonarr;
      if (!client) {
        return err(`${service} is not configured. Cannot compare naming.`);
      }

      const [userNaming, trashNaming] = await Promise.all([
        client.getNamingConfig(),
        trashClient.getNaming(service),
      ]);
      if (!trashNaming) {
        return err(`Could not fetch TRaSH naming for ${service}`);
      }

      const serverMap: Record<string, { folder: string; file: string }> = {
        plex: { folder: 'plex-imdb', file: 'plex-imdb' },
        emby: { folder: 'emby-imdb', file: 'emby-imdb' },
        jellyfin: { folder: 'jellyfin-imdb', file: 'jellyfin-imdb' },
        standard: { folder: 'default', file: 'standard' },
      };
      const keys = serverMap[mediaServer] ?? serverMap['standard'];
      const recommendedFolder = service === 'sonarr'
        ? (trashNaming.series?.[keys.folder] ?? trashNaming.series?.['default'])
        : (trashNaming.folder?.[keys.folder] ?? trashNaming.folder?.['default']);
      const recommendedFile = service === 'sonarr'
        ? (trashNaming.episodes?.standard?.[keys.file] ?? trashNaming.episodes?.standard?.['default'])
        : (trashNaming.file?.[keys.file] ?? trashNaming.file?.['standard']);

      const n = userNaming as unknown as Record<string, unknown>;
      const userFolder = (n['movieFolderFormat'] ?? n['seriesFolderFormat']) as string | undefined;
      const userFile = (n['standardMovieFormat'] ?? n['standardEpisodeFormat']) as string | undefined;

      return ok({
        mediaServer,
        yourNaming: { folder: userFolder, file: userFile },
        trashRecommended: { folder: recommendedFolder, file: recommendedFile },
        folderMatch: userFolder === recommendedFolder,
        fileMatch: userFile === recommendedFile,
        recommendations: [
          ...(userFolder !== recommendedFolder ? [`Update folder format to: ${recommendedFolder}`] : []),
          ...(userFile !== recommendedFile ? [`Update file format to: ${recommendedFile}`] : []),
        ],
      });
    },
  },
};
