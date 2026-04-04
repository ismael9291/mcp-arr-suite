import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { trashModule } from '../../../src/trash/tools.js';
import { RadarrClient } from '../../../src/clients/arr-client.js';
import { mswServer } from '../../setup.js';
import {
  trashQualityProfileFixture,
  trashCustomFormatFixtures,
  trashQualitySizeFixtures,
  trashNamingFixtures,
} from '../../fixtures/trash/profiles.js';
import { qualityProfileFixtures, namingConfigFixture } from '../../fixtures/shared/config.js';

const GITHUB_API = 'https://api.github.com/repos/TRaSH-Guides/Guides/contents/docs/json';
const GITHUB_RAW = 'https://raw.githubusercontent.com/TRaSH-Guides/Guides/master/docs/json';
const RADARR_URL = 'http://radarr.test';

// ─── trash_list_profiles ──────────────────────────────────────────────────────

describe('trash_list_profiles', () => {
  it('returns profile names and descriptions for radarr', async () => {
    const profileName = 'uhd-bluray-web';
    mswServer.use(
      http.get(`${GITHUB_API}/radarr/quality-profiles`, () =>
        HttpResponse.json([{ name: `${profileName}.json`, type: 'file' }])
      ),
      http.get(`${GITHUB_RAW}/radarr/quality-profiles/${profileName}.json`, () =>
        HttpResponse.json(trashQualityProfileFixture)
      ),
    );

    const result = await trashModule.handlers['trash_list_profiles']({ service: 'radarr' }, {});
    const data = JSON.parse(result.content[0].text);

    expect(data.service).toBe('radarr');
    expect(data.count).toBe(1);
    expect(data.profiles[0]).toHaveProperty('name');
    expect(data.profiles[0]).not.toHaveProperty('trash_id');
    expect(data.profiles[0]).not.toHaveProperty('items');
  });
});

// ─── trash_get_profile ────────────────────────────────────────────────────────

describe('trash_get_profile', () => {
  beforeEach(() => {
    mswServer.use(
      http.get(`${GITHUB_RAW}/radarr/quality-profiles/uhd-bluray-web.json`, () =>
        HttpResponse.json(trashQualityProfileFixture)
      ),
    );
  });

  it('returns profile details including cutoff and custom formats', async () => {
    const result = await trashModule.handlers['trash_get_profile']({ service: 'radarr', profile: 'uhd-bluray-web' }, {});
    const data = JSON.parse(result.content[0].text);

    expect(data.name).toBe(trashQualityProfileFixture.name);
    expect(data.upgradeAllowed).toBe(true);
    expect(data.cutoff).toBeDefined();
    // trash_id is intentionally returned so the LLM can cross-reference
    expect(data.trash_id).toBe(trashQualityProfileFixture.trash_id);
    expect(data.qualities).toBeInstanceOf(Array);
    expect(data.customFormats).toBeInstanceOf(Array);
    // Raw internals that are not returned by the handler
    expect(data).not.toHaveProperty('group');
    expect(data).not.toHaveProperty('minUpgradeFormatScore');
  });

  it('returns isError: true for unknown profile name', async () => {
    mswServer.use(
      http.get(`${GITHUB_RAW}/radarr/quality-profiles/nonexistent.json`, () =>
        new HttpResponse(null, { status: 404 })
      ),
    );
    const result = await trashModule.handlers['trash_get_profile']({ service: 'radarr', profile: 'nonexistent' }, {});
    expect(result.isError).toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toMatch(/not found/i);
  });
});

// ─── trash_get_quality_sizes ──────────────────────────────────────────────────

describe('trash_get_quality_sizes', () => {
  it('returns size recommendations for a service', async () => {
    const sizeName = 'movies';
    mswServer.use(
      http.get(`${GITHUB_API}/radarr/quality-size`, () =>
        HttpResponse.json([{ name: `${sizeName}.json`, type: 'file' }])
      ),
      http.get(`${GITHUB_RAW}/radarr/quality-size/${sizeName}.json`, () =>
        HttpResponse.json(trashQualitySizeFixtures[0])
      ),
    );

    const result = await trashModule.handlers['trash_get_quality_sizes']({ service: 'radarr' }, {});
    const data = JSON.parse(result.content[0].text);

    expect(data.service).toBe('radarr');
    expect(data.profiles).toBeInstanceOf(Array);
    expect(data.profiles[0].qualities[0]).toHaveProperty('quality');
    // Sizes should be formatted with units
    expect(data.profiles[0].qualities[0].min).toMatch(/MB\/min/);
  });
});

// ─── trash_get_naming ─────────────────────────────────────────────────────────

describe('trash_get_naming', () => {
  beforeEach(() => {
    mswServer.use(
      http.get(`${GITHUB_RAW}/radarr/naming/radarr-naming.json`, () =>
        HttpResponse.json(trashNamingFixtures['radarr'])
      ),
    );
  });

  it('returns recommended folder and file format for given media server', async () => {
    const result = await trashModule.handlers['trash_get_naming']({ service: 'radarr', mediaServer: 'plex' }, {});
    const data = JSON.parse(result.content[0].text);

    expect(data.service).toBe('radarr');
    expect(data.mediaServer).toBe('plex');
    expect(data.recommended).toHaveProperty('folder');
    expect(data.recommended).toHaveProperty('file');
    expect(data.allFolderOptions).toBeInstanceOf(Array);
    expect(data.allFileOptions).toBeInstanceOf(Array);
  });

  it('returns standard naming when mediaServer is "standard"', async () => {
    const result = await trashModule.handlers['trash_get_naming']({ service: 'radarr', mediaServer: 'standard' }, {});
    const data = JSON.parse(result.content[0].text);
    expect(data.recommended.folder).toBeDefined();
    expect(data.recommended.file).toBeDefined();
  });
});

// ─── trash_list_custom_formats ────────────────────────────────────────────────

describe('trash_list_custom_formats', () => {
  it('returns custom formats with categories', async () => {
    const cfName = 'hdr10';
    mswServer.use(
      http.get(`${GITHUB_API}/radarr/cf`, () =>
        HttpResponse.json([{ name: `${cfName}.json`, type: 'file' }])
      ),
      http.get(`${GITHUB_RAW}/radarr/cf/${cfName}.json`, () =>
        HttpResponse.json(trashCustomFormatFixtures[0])
      ),
    );

    const result = await trashModule.handlers['trash_list_custom_formats']({ service: 'radarr' }, {});
    const data = JSON.parse(result.content[0].text);

    expect(data.count).toBeGreaterThan(0);
    expect(data.formats[0]).toHaveProperty('name');
    expect(data.formats[0]).toHaveProperty('categories');
  });
});

// ─── trash_compare_profile ────────────────────────────────────────────────────

describe('trash_compare_profile', () => {
  it('returns isError when the service client is not configured', async () => {
    // No radarr in clients
    const result = await trashModule.handlers['trash_compare_profile']({
      service: 'radarr',
      profileId: 4,
      trashProfile: 'uhd-bluray-web',
    }, {});

    expect(result.isError).toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toMatch(/not configured/i);
  });

  it('compares user profile against TRaSH recommendations', async () => {
    mswServer.use(
      http.get(`${RADARR_URL}/api/v3/qualityprofile`, () => HttpResponse.json(qualityProfileFixtures)),
      http.get(`${GITHUB_RAW}/radarr/quality-profiles/uhd-bluray-web.json`, () =>
        HttpResponse.json(trashQualityProfileFixture)
      ),
    );
    const radarr = new RadarrClient({ url: RADARR_URL, apiKey: 'k' });
    const result = await trashModule.handlers['trash_compare_profile']({
      service: 'radarr',
      profileId: 4,
      trashProfile: 'uhd-bluray-web',
    }, { radarr });

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('yourProfile');
    expect(data).toHaveProperty('trashProfile');
    expect(data).toHaveProperty('qualityComparison');
    expect(data).toHaveProperty('customFormatComparison');
    expect(data).toHaveProperty('recommendations');
  });
});

// ─── trash_compare_naming ─────────────────────────────────────────────────────

describe('trash_compare_naming', () => {
  it('returns isError when service client is not configured', async () => {
    const result = await trashModule.handlers['trash_compare_naming']({
      service: 'radarr',
      mediaServer: 'plex',
    }, {});

    expect(result.isError).toBe(true);
  });

  it('compares current naming against TRaSH recommendations', async () => {
    mswServer.use(
      http.get(`${RADARR_URL}/api/v3/config/naming`, () => HttpResponse.json(namingConfigFixture)),
      http.get(`${GITHUB_RAW}/radarr/naming/radarr-naming.json`, () =>
        HttpResponse.json(trashNamingFixtures['radarr'])
      ),
    );
    const radarr = new RadarrClient({ url: RADARR_URL, apiKey: 'k' });
    const result = await trashModule.handlers['trash_compare_naming']({
      service: 'radarr',
      mediaServer: 'plex',
    }, { radarr });

    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('mediaServer');
    expect(data).toHaveProperty('yourNaming');
    expect(data).toHaveProperty('trashRecommended');
    expect(data).toHaveProperty('recommendations');
  });
});
