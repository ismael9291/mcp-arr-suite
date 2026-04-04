import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { buildConfigModule } from '../../../src/shared/config-tools.js';
import { RadarrClient, SonarrClient, LidarrClient } from '../../../src/clients/arr-client.js';
import { mswServer } from '../../setup.js';
import {
  qualityProfileFixtures,
  healthCheckFixtures,
  rootFolderFixtures,
  downloadClientFixtures,
  namingConfigFixture,
  mediaManagementFixture,
  qualityDefinitionFixtures,
  tagFixtures,
  indexerFixtures,
  systemStatusFixture,
} from '../../fixtures/shared/config.js';
import { metadataProfileFixtures } from '../../fixtures/lidarr/artists.js';

const RADARR_URL = 'http://radarr.test';
const RADARR_KEY = 'radarr-key';
const SONARR_URL = 'http://sonarr.test';
const SONARR_KEY = 'sonarr-key';
const LIDARR_URL = 'http://lidarr.test';
const LIDARR_KEY = 'lidarr-key';

function radarrHandlers() {
  return [
    http.get(`${RADARR_URL}/api/v3/qualityprofile`, () => HttpResponse.json(qualityProfileFixtures)),
    http.get(`${RADARR_URL}/api/v3/health`, () => HttpResponse.json(healthCheckFixtures)),
    http.get(`${RADARR_URL}/api/v3/rootfolder`, () => HttpResponse.json(rootFolderFixtures)),
    http.get(`${RADARR_URL}/api/v3/downloadclient`, () => HttpResponse.json(downloadClientFixtures)),
    http.get(`${RADARR_URL}/api/v3/config/naming`, () => HttpResponse.json(namingConfigFixture)),
    http.get(`${RADARR_URL}/api/v3/tag`, () => HttpResponse.json(tagFixtures)),
    http.get(`${RADARR_URL}/api/v3/system/status`, () => HttpResponse.json(systemStatusFixture)),
    http.get(`${RADARR_URL}/api/v3/qualitydefinition`, () => HttpResponse.json(qualityDefinitionFixtures)),
    http.get(`${RADARR_URL}/api/v3/config/mediamanagement`, () => HttpResponse.json(mediaManagementFixture)),
    http.get(`${RADARR_URL}/api/v3/indexer`, () => HttpResponse.json(indexerFixtures)),
  ];
}

describe('buildConfigModule', () => {
  it('returns a module with exactly 7 tools', () => {
    const mod = buildConfigModule('radarr', 'Radarr (Movies)');
    expect(mod.tools).toHaveLength(7);
  });

  it('prefixes all tool names with the service name', () => {
    const mod = buildConfigModule('sonarr', 'Sonarr (TV)');
    for (const tool of mod.tools) {
      expect(tool.name).toMatch(/^sonarr_/);
    }
  });

  it('includes a handler for every tool', () => {
    const mod = buildConfigModule('radarr', 'Radarr (Movies)');
    for (const tool of mod.tools) {
      expect(mod.handlers[tool.name]).toBeTypeOf('function');
    }
  });

  it('names match expected set for radarr', () => {
    const mod = buildConfigModule('radarr', 'Radarr (Movies)');
    const names = mod.tools.map(t => t.name);
    expect(names).toContain('radarr_get_quality_profiles');
    expect(names).toContain('radarr_get_health');
    expect(names).toContain('radarr_get_root_folders');
    expect(names).toContain('radarr_get_download_clients');
    expect(names).toContain('radarr_get_naming');
    expect(names).toContain('radarr_get_tags');
    expect(names).toContain('radarr_review_setup');
  });
});

describe('config tool handlers — radarr', () => {
  let radarrClient: RadarrClient;

  beforeEach(() => {
    radarrClient = new RadarrClient({ url: RADARR_URL, apiKey: RADARR_KEY });
  });

  it('get_quality_profiles returns trimmed profile data', async () => {
    mswServer.use(http.get(`${RADARR_URL}/api/v3/qualityprofile`, () => HttpResponse.json(qualityProfileFixtures)));
    const mod = buildConfigModule('radarr', 'Radarr');
    const result = await mod.handlers['radarr_get_quality_profiles']({}, { radarr: radarrClient });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(qualityProfileFixtures.length);
    expect(data.profiles[0]).toHaveProperty('id');
    expect(data.profiles[0]).toHaveProperty('name');
    expect(data.profiles[0]).toHaveProperty('allowedQualities');
    // Raw fields like 'items' should not be present
    expect(data.profiles[0]).not.toHaveProperty('items');
  });

  it('get_health returns healthy status when no issues', async () => {
    mswServer.use(http.get(`${RADARR_URL}/api/v3/health`, () => HttpResponse.json([])));
    const mod = buildConfigModule('radarr', 'Radarr');
    const result = await mod.handlers['radarr_get_health']({}, { radarr: radarrClient });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe('healthy');
    expect(data.issueCount).toBe(0);
  });

  it('get_health returns issues when health checks fail', async () => {
    mswServer.use(http.get(`${RADARR_URL}/api/v3/health`, () => HttpResponse.json(healthCheckFixtures)));
    const mod = buildConfigModule('radarr', 'Radarr');
    const result = await mod.handlers['radarr_get_health']({}, { radarr: radarrClient });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe('issues detected');
    expect(data.issueCount).toBe(1);
    expect(data.issues[0].message).toBe(healthCheckFixtures[0].message);
  });

  it('get_root_folders formats freeSpace as human-readable string', async () => {
    mswServer.use(http.get(`${RADARR_URL}/api/v3/rootfolder`, () => HttpResponse.json(rootFolderFixtures)));
    const mod = buildConfigModule('radarr', 'Radarr');
    const result = await mod.handlers['radarr_get_root_folders']({}, { radarr: radarrClient });
    const data = JSON.parse(result.content[0].text);
    expect(data.folders[0].freeSpace).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
    expect(data.folders[0].freeSpaceBytes).toBe(rootFolderFixtures[0].freeSpace);
  });

  it('get_download_clients returns client config', async () => {
    mswServer.use(http.get(`${RADARR_URL}/api/v3/downloadclient`, () => HttpResponse.json(downloadClientFixtures)));
    const mod = buildConfigModule('radarr', 'Radarr');
    const result = await mod.handlers['radarr_get_download_clients']({}, { radarr: radarrClient });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(1);
    expect(data.clients[0].name).toBe('SABnzbd');
    expect(data.clients[0].protocol).toBe('usenet');
  });

  it('get_naming returns naming config directly', async () => {
    mswServer.use(http.get(`${RADARR_URL}/api/v3/config/naming`, () => HttpResponse.json(namingConfigFixture)));
    const mod = buildConfigModule('radarr', 'Radarr');
    const result = await mod.handlers['radarr_get_naming']({}, { radarr: radarrClient });
    const data = JSON.parse(result.content[0].text);
    expect(data.standardMovieFormat).toBe(namingConfigFixture.standardMovieFormat);
  });

  it('get_tags returns all tags', async () => {
    mswServer.use(http.get(`${RADARR_URL}/api/v3/tag`, () => HttpResponse.json(tagFixtures)));
    const mod = buildConfigModule('radarr', 'Radarr');
    const result = await mod.handlers['radarr_get_tags']({}, { radarr: radarrClient });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(2);
    expect(data.tags[0]).toEqual({ id: 1, label: 'hdr' });
  });

  it('throws when client is not configured', async () => {
    const mod = buildConfigModule('radarr', 'Radarr');
    await expect(mod.handlers['radarr_get_quality_profiles']({}, {})).rejects.toThrow(
      /radarr is not configured/
    );
  });
});

describe('review_setup handler', () => {
  it('fires 10 concurrent requests and assembles a comprehensive report', async () => {
    mswServer.use(...radarrHandlers());
    const radarrClient = new RadarrClient({ url: RADARR_URL, apiKey: RADARR_KEY });
    const mod = buildConfigModule('radarr', 'Radarr (Movies)');
    const result = await mod.handlers['radarr_review_setup']({}, { radarr: radarrClient });
    const data = JSON.parse(result.content[0].text);

    expect(data.service).toBe('radarr');
    expect(data.version).toBe(systemStatusFixture.version);
    expect(data.health).toBeDefined();
    expect(data.storage.rootFolders).toHaveLength(rootFolderFixtures.length);
    expect(data.qualityProfiles).toHaveLength(qualityProfileFixtures.length);
    expect(data.downloadClients).toHaveLength(downloadClientFixtures.length);
    expect(data.indexers).toHaveLength(indexerFixtures.length);
    expect(data.naming).toBeDefined();
    expect(data.mediaManagement).toBeDefined();
    expect(data.tags).toBeInstanceOf(Array);
  });

  it('includes metadataProfiles only for lidarr', async () => {
    // Lidarr uses /api/v1/ (not v3)
    mswServer.use(
      http.get(`${LIDARR_URL}/api/v1/qualityprofile`, () => HttpResponse.json(qualityProfileFixtures)),
      http.get(`${LIDARR_URL}/api/v1/health`, () => HttpResponse.json([])),
      http.get(`${LIDARR_URL}/api/v1/rootfolder`, () => HttpResponse.json(rootFolderFixtures)),
      http.get(`${LIDARR_URL}/api/v1/downloadclient`, () => HttpResponse.json(downloadClientFixtures)),
      http.get(`${LIDARR_URL}/api/v1/config/naming`, () => HttpResponse.json(namingConfigFixture)),
      http.get(`${LIDARR_URL}/api/v1/tag`, () => HttpResponse.json(tagFixtures)),
      http.get(`${LIDARR_URL}/api/v1/system/status`, () => HttpResponse.json(systemStatusFixture)),
      http.get(`${LIDARR_URL}/api/v1/qualitydefinition`, () => HttpResponse.json(qualityDefinitionFixtures)),
      http.get(`${LIDARR_URL}/api/v1/config/mediamanagement`, () => HttpResponse.json(mediaManagementFixture)),
      http.get(`${LIDARR_URL}/api/v1/indexer`, () => HttpResponse.json(indexerFixtures)),
      http.get(`${LIDARR_URL}/api/v1/metadataprofile`, () => HttpResponse.json(metadataProfileFixtures)),
    );
    const lidarrClient = new LidarrClient({ url: LIDARR_URL, apiKey: LIDARR_KEY });
    const mod = buildConfigModule('lidarr', 'Lidarr (Music)');
    const result = await mod.handlers['lidarr_review_setup']({}, { lidarr: lidarrClient });
    const data = JSON.parse(result.content[0].text);

    expect(data.metadataProfiles).toBeDefined();
    expect(data.metadataProfiles).toHaveLength(metadataProfileFixtures.length);
  });

  it('does not include metadataProfiles for sonarr', async () => {
    mswServer.use(
      http.get(`${SONARR_URL}/api/v3/qualityprofile`, () => HttpResponse.json(qualityProfileFixtures)),
      http.get(`${SONARR_URL}/api/v3/health`, () => HttpResponse.json([])),
      http.get(`${SONARR_URL}/api/v3/rootfolder`, () => HttpResponse.json(rootFolderFixtures)),
      http.get(`${SONARR_URL}/api/v3/downloadclient`, () => HttpResponse.json(downloadClientFixtures)),
      http.get(`${SONARR_URL}/api/v3/config/naming`, () => HttpResponse.json(namingConfigFixture)),
      http.get(`${SONARR_URL}/api/v3/tag`, () => HttpResponse.json(tagFixtures)),
      http.get(`${SONARR_URL}/api/v3/system/status`, () => HttpResponse.json(systemStatusFixture)),
      http.get(`${SONARR_URL}/api/v3/qualitydefinition`, () => HttpResponse.json(qualityDefinitionFixtures)),
      http.get(`${SONARR_URL}/api/v3/config/mediamanagement`, () => HttpResponse.json(mediaManagementFixture)),
      http.get(`${SONARR_URL}/api/v3/indexer`, () => HttpResponse.json(indexerFixtures)),
    );
    const sonarrClient = new SonarrClient({ url: SONARR_URL, apiKey: SONARR_KEY });
    const mod = buildConfigModule('sonarr', 'Sonarr (TV)');
    const result = await mod.handlers['sonarr_review_setup']({}, { sonarr: sonarrClient });
    const data = JSON.parse(result.content[0].text);

    expect(data).not.toHaveProperty('metadataProfiles');
  });
});
