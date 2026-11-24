import { describe, it, expect, beforeEach, vi } from 'vitest';
import { maintainerrModule } from '../../../src/services/maintainerr.js';
import { MaintainerrClient } from '../../../src/clients/maintainerr-client.js';
import type { ClientMap } from '../../../src/types.js';
import {
  settingsFixture,
  ruleFixture,
  collectionFixture,
  collectionMediaFixture,
  exclusionFixture,
  plexLibrariesFixture,
  ruleConstantsFixture,
} from '../../fixtures/maintainerr/data.js';

function makeClient(overrides?: Partial<MaintainerrClient>): MaintainerrClient {
  const base = new MaintainerrClient({ url: 'http://mock' });
  return Object.assign(base, overrides);
}

function parse<T = Record<string, unknown>>(result: { content: Array<{ text: string }> }): T {
  return JSON.parse(result.content[0].text) as T;
}

let clients: ClientMap;

beforeEach(() => {
  clients = {
    maintainerr: makeClient({
      getSettings: vi.fn().mockResolvedValue(settingsFixture),
      updateSettings: vi.fn().mockResolvedValue(settingsFixture),
      getVersion: vi.fn().mockResolvedValue('2.19.0'),
      checkSetup: vi.fn().mockResolvedValue('true'),
      testPlex: vi.fn().mockResolvedValue({ status: 'OK', code: 1, message: '1.32.0' }),
      testOverseerr: vi.fn().mockResolvedValue({ status: 'OK', code: 1, message: '1.0.0' }),
      testSonarr: vi.fn().mockResolvedValue({ status: 'OK', code: 1, message: '3.0.0' }),
      testRadarr: vi.fn().mockResolvedValue({ status: 'OK', code: 1, message: '4.0.0' }),
      testTautulli: vi.fn().mockResolvedValue({ status: 'OK', code: 1, message: '2.0.0' }),
      testJellyseerr: vi.fn().mockResolvedValue({ status: 'OK', code: 1, message: '1.0.0' }),
      getPlexServers: vi.fn().mockResolvedValue([{ name: 'MyPlex', host: '192.168.1.10' }]),
      setPlexToken: vi.fn().mockResolvedValue({ status: 'OK' }),
      validateCron: vi.fn().mockResolvedValue({ valid: true }),
      getPlexLibraries: vi.fn().mockResolvedValue(plexLibrariesFixture),
      getLibraryContent: vi.fn().mockResolvedValue({ items: [] }),
      searchLibrary: vi.fn().mockResolvedValue([]),
      searchPlex: vi.fn().mockResolvedValue([]),
      getLibraryCollections: vi.fn().mockResolvedValue([]),
      getPlexCollectionDetails: vi.fn().mockResolvedValue({ id: '1', title: 'Test' }),
      getPlexCollectionChildren: vi.fn().mockResolvedValue([]),
      getMediaMetadata: vi.fn().mockResolvedValue({ id: 1, title: 'Movie' }),
      getMediaSeen: vi.fn().mockResolvedValue([]),
      getMediaChildren: vi.fn().mockResolvedValue([]),
      getPlexUsers: vi.fn().mockResolvedValue([]),
      createPlexCollection: vi.fn().mockResolvedValue({ id: '42' }),
      updatePlexCollectionSettings: vi.fn().mockResolvedValue({ success: true }),
      addToPlexCollection: vi.fn().mockResolvedValue({ success: true }),
      removeFromPlexCollection: vi.fn().mockResolvedValue({ success: true }),
      deletePlexCollection: vi.fn().mockResolvedValue(undefined),
      getRuleConstants: vi.fn().mockResolvedValue(ruleConstantsFixture),
      getRules: vi.fn().mockResolvedValue([ruleFixture]),
      getRuleCount: vi.fn().mockResolvedValue(1),
      getRule: vi.fn().mockResolvedValue(ruleFixture),
      createRule: vi.fn().mockResolvedValue({ ...ruleFixture, id: 2 }),
      updateRule: vi.fn().mockResolvedValue(ruleFixture),
      deleteRule: vi.fn().mockResolvedValue(undefined),
      executeRules: vi.fn().mockResolvedValue({ status: 'started' }),
      stopRules: vi.fn().mockResolvedValue({ status: 'stopped' }),
      testRule: vi.fn().mockResolvedValue([]),
      addExclusion: vi.fn().mockResolvedValue(exclusionFixture),
      getExclusions: vi.fn().mockResolvedValue([exclusionFixture]),
      deleteExclusion: vi.fn().mockResolvedValue(undefined),
      deleteExclusionsForMedia: vi.fn().mockResolvedValue(undefined),
      getCommunityRules: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      updateRulesSchedule: vi.fn().mockResolvedValue({ success: true }),
      getCollections: vi.fn().mockResolvedValue([collectionFixture]),
      getCollection: vi.fn().mockResolvedValue(collectionFixture),
      updateCollection: vi.fn().mockResolvedValue(collectionFixture),
      triggerCollectionHandler: vi.fn().mockResolvedValue({ status: 'started' }),
      activateCollection: vi.fn().mockResolvedValue({ success: true }),
      deactivateCollection: vi.fn().mockResolvedValue({ success: true }),
      getCollectionMedia: vi.fn().mockResolvedValue(collectionMediaFixture),
      getCollectionMediaCount: vi.fn().mockResolvedValue(2),
      addToCollection: vi.fn().mockResolvedValue({ success: true }),
      removeFromCollection: vi.fn().mockResolvedValue({ success: true }),
      getCollectionLogs: vi.fn().mockResolvedValue({ items: [] }),
      getCollectionExclusions: vi.fn().mockResolvedValue({ items: [] }),
      updateCollectionsSchedule: vi.fn().mockResolvedValue({ success: true }),
    }),
  };
});

// ─── Missing client guard ─────────────────────────────────────────────────────

describe('missing client guard', () => {
  it('returns isError when maintainerr is not configured', async () => {
    const emptyClients: ClientMap = {};
    for (const [name, handler] of Object.entries(maintainerrModule.handlers)) {
      const result = await handler({}, emptyClients);
      expect(result.isError, `${name} should return isError when not configured`).toBe(true);
      expect(result.content[0].text).toContain('MAINTAINERR_URL');
    }
  });
});

// ─── Settings handlers ────────────────────────────────────────────────────────

describe('maintainerr_get_settings', () => {
  it('returns settings data', async () => {
    const result = await maintainerrModule.handlers['maintainerr_get_settings']({}, clients);
    const data = parse(result);
    expect(data.id).toBe(1);
    expect(data.plex_name).toBe('My Plex Server');
  });
});

describe('maintainerr_update_settings', () => {
  it('passes the full settings object to the client', async () => {
    await maintainerrModule.handlers['maintainerr_update_settings']({ settings: settingsFixture }, clients);
    expect(clients.maintainerr!.updateSettings).toHaveBeenCalledWith(settingsFixture);
  });
});

describe('maintainerr_get_version', () => {
  it('returns version string', async () => {
    const result = await maintainerrModule.handlers['maintainerr_get_version']({}, clients);
    const data = parse(result);
    expect(data).toBe('2.19.0');
  });
});

describe('maintainerr_check_setup', () => {
  it('wraps result in configured key', async () => {
    const result = await maintainerrModule.handlers['maintainerr_check_setup']({}, clients);
    const data = parse<{ configured: string }>(result);
    expect(data.configured).toBe('true');
  });
});

describe('maintainerr_test_plex', () => {
  it('returns plex test result', async () => {
    const result = await maintainerrModule.handlers['maintainerr_test_plex']({}, clients);
    const data = parse<{ status: string }>(result);
    expect(data.status).toBe('OK');
  });
});

describe('maintainerr_test_overseerr', () => {
  it('passes url and api_key to client', async () => {
    await maintainerrModule.handlers['maintainerr_test_overseerr'](
      { url: 'http://overseerr:5055', api_key: 'key123' },
      clients
    );
    expect(clients.maintainerr!.testOverseerr).toHaveBeenCalledWith('http://overseerr:5055', 'key123');
  });
});

describe('maintainerr_validate_cron', () => {
  it('passes cron string to client', async () => {
    await maintainerrModule.handlers['maintainerr_validate_cron']({ cron: '0 */6 * * *' }, clients);
    expect(clients.maintainerr!.validateCron).toHaveBeenCalledWith('0 */6 * * *');
  });
});

// ─── Plex handlers ────────────────────────────────────────────────────────────

describe('maintainerr_get_plex_libraries', () => {
  it('returns library list', async () => {
    const result = await maintainerrModule.handlers['maintainerr_get_plex_libraries']({}, clients);
    const data = parse<typeof plexLibrariesFixture>(result);
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe('Movies');
  });
});

describe('maintainerr_get_library_content', () => {
  it('defaults page to 1', async () => {
    await maintainerrModule.handlers['maintainerr_get_library_content']({ libraryId: '1' }, clients);
    expect(clients.maintainerr!.getLibraryContent).toHaveBeenCalledWith('1', 1);
  });

  it('passes explicit page number', async () => {
    await maintainerrModule.handlers['maintainerr_get_library_content']({ libraryId: '1', page: 3 }, clients);
    expect(clients.maintainerr!.getLibraryContent).toHaveBeenCalledWith('1', 3);
  });
});

describe('maintainerr_create_plex_collection', () => {
  it('returns the created collection ID', async () => {
    const result = await maintainerrModule.handlers['maintainerr_create_plex_collection'](
      { libraryId: '1', title: 'New Collection', type: 1 },
      clients
    );
    const data = parse<{ id: string }>(result);
    expect(data.id).toBe('42');
  });
});

describe('maintainerr_delete_plex_collection', () => {
  it('returns deleted confirmation with collectionId', async () => {
    const result = await maintainerrModule.handlers['maintainerr_delete_plex_collection'](
      { collectionId: '7' },
      clients
    );
    const data = parse<{ deleted: boolean; collectionId: string }>(result);
    expect(data.deleted).toBe(true);
    expect(data.collectionId).toBe('7');
  });
});

// ─── Rules handlers ───────────────────────────────────────────────────────────

describe('maintainerr_get_rule_constants', () => {
  it('returns constants with applications array', async () => {
    const result = await maintainerrModule.handlers['maintainerr_get_rule_constants']({}, clients);
    const data = parse<typeof ruleConstantsFixture>(result);
    expect(data.applications).toHaveLength(3);
    expect(data.applications[0].name).toBe('Plex');
  });
});

describe('maintainerr_get_rules', () => {
  it('returns rules array', async () => {
    const result = await maintainerrModule.handlers['maintainerr_get_rules']({}, clients);
    const data = parse<typeof ruleFixture[]>(result);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Unwatched Movies');
  });
});

describe('maintainerr_get_rule_count', () => {
  it('wraps count in count key', async () => {
    const result = await maintainerrModule.handlers['maintainerr_get_rule_count']({}, clients);
    const data = parse<{ count: number }>(result);
    expect(data.count).toBe(1);
  });
});

describe('maintainerr_create_rule', () => {
  it('applies correct defaults for optional fields', async () => {
    await maintainerrModule.handlers['maintainerr_create_rule'](
      { name: 'Test Rule', libraryId: 1, dataType: 1 },
      clients
    );
    expect(clients.maintainerr!.createRule).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Rule',
        libraryId: 1,
        dataType: 1,
        isActive: true,
        arrAction: 0,
        useRules: true,
        listExclusions: true,
        forceOverseerr: false,
        manualCollection: false,
        description: '',
        rules: [],
      })
    );
  });

  it('passes through deleteAfterDays when provided', async () => {
    await maintainerrModule.handlers['maintainerr_create_rule'](
      { name: 'Test', libraryId: 1, dataType: 1, deleteAfterDays: 30 },
      clients
    );
    expect(clients.maintainerr!.createRule).toHaveBeenCalledWith(
      expect.objectContaining({ deleteAfterDays: 30 })
    );
  });

  it('does not include deleteAfterDays when not provided', async () => {
    await maintainerrModule.handlers['maintainerr_create_rule'](
      { name: 'Test', libraryId: 1, dataType: 1 },
      clients
    );
    const call = (clients.maintainerr!.createRule as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('deleteAfterDays');
  });
});

describe('maintainerr_update_rule', () => {
  const group = {
    id: 1, name: 'Unwatched', description: 'd', libraryId: 1, isActive: true, useRules: true, dataType: 1,
    rules: [{ ruleJson: JSON.stringify({ operator: null, action: 2, firstVal: [0, 5], section: 0 }) }],
    collection: {
      arrAction: 0, listExclusions: true, forceOverseerr: false, radarrSettingsId: 1, sonarrSettingsId: null,
      visibleOnRecommended: false, visibleOnHome: false, deleteAfterDays: null,
      manualCollection: false, manualCollectionName: '', keepLogsForMonths: 6,
    },
  };

  beforeEach(() => {
    vi.mocked(clients.maintainerr!.getRules).mockResolvedValue([group]);
    vi.mocked(clients.maintainerr!.updateRule).mockResolvedValue({ code: 1, result: 'Success' });
  });

  it('merges changes into the full current group so links are preserved', async () => {
    await maintainerrModule.handlers['maintainerr_update_rule']({ id: 1, isActive: false }, clients);
    const call = vi.mocked(clients.maintainerr!.updateRule).mock.calls[0][0] as Record<string, unknown>;
    expect(call.isActive).toBe(false);
    expect(call.name).toBe('Unwatched');
    expect(call.radarrSettingsId).toBe(1);
    expect(call.rules).toEqual([{ operator: null, action: 2, firstVal: [0, 5], section: 0 }]);
    expect((call.collection as Record<string, unknown>).keepLogsForMonths).toBe(6);
  });

  it('replaces rules and deleteAfterDays when given', async () => {
    const rules = [{ operator: null, action: 9, firstVal: [1, 2], section: 0 }];
    await maintainerrModule.handlers['maintainerr_update_rule']({ id: 1, rules, deleteAfterDays: 14 }, clients);
    const call = vi.mocked(clients.maintainerr!.updateRule).mock.calls[0][0] as Record<string, unknown>;
    expect(call.rules).toEqual(rules);
    expect((call.collection as Record<string, unknown>).deleteAfterDays).toBe(14);
  });

  it('keeps a null Sonarr link and only sets deleteAfterDays on the collection', async () => {
    await maintainerrModule.handlers['maintainerr_update_rule']({ id: 1, deleteAfterDays: 30 }, clients);
    const call = vi.mocked(clients.maintainerr!.updateRule).mock.calls[0][0] as Record<string, unknown>;
    expect(call).toHaveProperty('sonarrSettingsId', null);
    expect(call).not.toHaveProperty('deleteAfterDays');
    expect(call.collection).toMatchObject({ deleteAfterDays: 30, keepLogsForMonths: 6 });
  });

  it('errors for an unknown group or a rejected update', async () => {
    expect((await maintainerrModule.handlers['maintainerr_update_rule']({ id: 99 }, clients)).isError).toBe(true);
    vi.mocked(clients.maintainerr!.updateRule).mockResolvedValue({ code: 0, result: 'Validation failed' });
    expect((await maintainerrModule.handlers['maintainerr_update_rule']({ id: 1 }, clients)).isError).toBe(true);
  });
});

describe('maintainerr_delete_media_exclusions bulk', () => {
  it('deletes each plexId', async () => {
    const result = await maintainerrModule.handlers['maintainerr_delete_media_exclusions']({ plexIds: [1, 2] }, clients);
    expect(clients.maintainerr!.deleteExclusionsForMedia).toHaveBeenCalledTimes(2);
    expect(parse<{ deleted: number }>(result).deleted).toBe(2);
  });
});

describe('maintainerr_delete_rule', () => {
  it('returns deleted confirmation with id', async () => {
    const result = await maintainerrModule.handlers['maintainerr_delete_rule']({ id: 1 }, clients);
    const data = parse<{ deleted: boolean; id: number }>(result);
    expect(data.deleted).toBe(true);
    expect(data.id).toBe(1);
  });
});

describe('maintainerr_execute_rules', () => {
  it('calls executeRules on the client', async () => {
    await maintainerrModule.handlers['maintainerr_execute_rules']({}, clients);
    expect(clients.maintainerr!.executeRules).toHaveBeenCalledOnce();
  });
});

describe('maintainerr_test_rule', () => {
  it('tests each media item against the rule group', async () => {
    vi.mocked(clients.maintainerr!.testRule)
      .mockResolvedValueOnce({ code: 1, result: [{ plexId: 10, result: true, sectionResults: [] }] })
      .mockResolvedValueOnce({ code: 0, result: 'Invalid input' });
    const result = await maintainerrModule.handlers['maintainerr_test_rule'](
      { rulegroupId: 1, mediaIds: [10, 11] },
      clients
    );
    expect(clients.maintainerr!.testRule).toHaveBeenCalledWith(1, 10);
    const data = parse<{ results: { mediaId: number; matches?: boolean; error?: string }[] }>(result);
    expect(data.results[0]).toMatchObject({ mediaId: 10, matches: true });
    expect(data.results[1]).toMatchObject({ mediaId: 11, error: 'Invalid input' });
  });

  it('accepts a single mediaId', async () => {
    vi.mocked(clients.maintainerr!.testRule)
      .mockResolvedValueOnce({ code: 1, result: [{ plexId: 7, result: false, sectionResults: [{ id: 0 }] }] });
    const result = await maintainerrModule.handlers['maintainerr_test_rule']({ rulegroupId: 2, mediaId: 7 }, clients);
    expect(clients.maintainerr!.testRule).toHaveBeenCalledWith(2, 7);
    expect(parse<{ results: unknown[] }>(result).results).toEqual([
      { mediaId: 7, matches: false, sectionResults: [{ id: 0 }] },
    ]);
  });

  it('errors when no media id is given', async () => {
    const result = await maintainerrModule.handlers['maintainerr_test_rule']({ rulegroupId: 1 }, clients);
    expect(result.isError).toBe(true);
  });
});

describe('maintainerr_add_exclusion', () => {
  it('adds a rule-group exclusion', async () => {
    const result = await maintainerrModule.handlers['maintainerr_add_exclusion'](
      { plexId: 12345, ruleGroupId: 1 },
      clients
    );
    const data = parse<{ scope: string; added: number }>(result);
    expect(clients.maintainerr!.addExclusion).toHaveBeenCalledWith(12345, 1);
    expect(data.scope).toBe('ruleGroup 1');
    expect(data.added).toBe(1);
  });

  it('adds global exclusions for multiple plexIds and reports failures', async () => {
    vi.mocked(clients.maintainerr!.addExclusion)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));
    const result = await maintainerrModule.handlers['maintainerr_add_exclusion'](
      { plexIds: [1, 2] },
      clients
    );
    const data = parse<{ scope: string; added: number; failed: { plexId: number }[] }>(result);
    expect(clients.maintainerr!.addExclusion).toHaveBeenCalledWith(1, undefined);
    expect(data.scope).toBe('global');
    expect(data.added).toBe(1);
    expect(data.failed).toEqual([{ plexId: 2, error: 'boom' }]);
  });

  it('errors when no id is given', async () => {
    const result = await maintainerrModule.handlers['maintainerr_add_exclusion']({}, clients);
    expect(result.isError).toBe(true);
  });
});

describe('maintainerr_get_library_content year filter', () => {
  it('scans all pages and returns compact matches', async () => {
    vi.mocked(clients.maintainerr!.getLibraryContent)
      .mockResolvedValueOnce({ totalSize: 3, items: [
        { ratingKey: '10', title: 'Old', year: 1999 },
        { ratingKey: '11', title: 'New', year: 2020 },
      ] })
      .mockResolvedValueOnce({ totalSize: 3, items: [{ ratingKey: '12', title: 'Unknown' }] });
    const result = await maintainerrModule.handlers['maintainerr_get_library_content'](
      { libraryId: '1', maxYear: 2006 },
      clients
    );
    const data = parse<{ libraryTotal: number; count: number; noYear: string[]; items: unknown[] }>(result);
    expect(clients.maintainerr!.getLibraryContent).toHaveBeenCalledTimes(2);
    expect(data.libraryTotal).toBe(3);
    expect(data.items).toEqual([{ ratingKey: 10, title: 'Old', year: 1999 }]);
    expect(data.noYear).toEqual(['Unknown']);
  });

  it('applies minYear and maxYear inclusively', async () => {
    vi.mocked(clients.maintainerr!.getLibraryContent).mockResolvedValueOnce({ totalSize: 3, items: [
      { ratingKey: '1', title: 'A', year: 2000 },
      { ratingKey: '2', title: 'B', year: 2003 },
      { ratingKey: '3', title: 'C', year: 2006 },
    ] });
    const result = await maintainerrModule.handlers['maintainerr_get_library_content'](
      { libraryId: '2', minYear: 2003, maxYear: 2006 },
      clients
    );
    const data = parse<{ count: number; items: { title: string }[] }>(result);
    expect(clients.maintainerr!.getLibraryContent).toHaveBeenCalledTimes(1);
    expect(data.items.map(i => i.title)).toEqual(['B', 'C']);
  });
});

describe('maintainerr_delete_exclusion', () => {
  it('returns deleted confirmation', async () => {
    const result = await maintainerrModule.handlers['maintainerr_delete_exclusion']({ id: 1 }, clients);
    const data = parse<{ deleted: boolean; id: number }>(result);
    expect(data.deleted).toBe(true);
    expect(data.id).toBe(1);
  });
});

describe('maintainerr_delete_media_exclusions', () => {
  it('deletes a single plexId', async () => {
    const result = await maintainerrModule.handlers['maintainerr_delete_media_exclusions'](
      { plexId: 12345 },
      clients
    );
    const data = parse<{ deleted: number; failed: unknown[] }>(result);
    expect(clients.maintainerr!.deleteExclusionsForMedia).toHaveBeenCalledWith(12345);
    expect(data.deleted).toBe(1);
    expect(data.failed).toEqual([]);
  });
});

describe('maintainerr_get_community_rules', () => {
  it('defaults page/limit/typeId', async () => {
    await maintainerrModule.handlers['maintainerr_get_community_rules']({}, clients);
    expect(clients.maintainerr!.getCommunityRules).toHaveBeenCalledWith(1, 10, 1);
  });

  it('passes explicit values', async () => {
    await maintainerrModule.handlers['maintainerr_get_community_rules'](
      { page: 2, limit: 5, typeId: 2 },
      clients
    );
    expect(clients.maintainerr!.getCommunityRules).toHaveBeenCalledWith(2, 5, 2);
  });
});

// ─── Collections handlers ─────────────────────────────────────────────────────

describe('maintainerr_get_collections', () => {
  it('returns collections array', async () => {
    const result = await maintainerrModule.handlers['maintainerr_get_collections']({}, clients);
    const data = parse<typeof collectionFixture[]>(result);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Unwatched Movies');
  });
});

describe('maintainerr_update_collection', () => {
  it('only sends provided fields', async () => {
    await maintainerrModule.handlers['maintainerr_update_collection'](
      { id: 1, deleteAfterDays: 14 },
      clients
    );
    const call = (clients.maintainerr!.updateCollection as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call.id).toBe(1);
    expect(call.deleteAfterDays).toBe(14);
    expect(call).not.toHaveProperty('title');
    expect(call).not.toHaveProperty('arrAction');
  });
});

describe('maintainerr_trigger_collection_handler', () => {
  it('calls triggerCollectionHandler on the client', async () => {
    await maintainerrModule.handlers['maintainerr_trigger_collection_handler']({}, clients);
    expect(clients.maintainerr!.triggerCollectionHandler).toHaveBeenCalledOnce();
  });
});

describe('maintainerr_get_collection_media', () => {
  it('returns media items', async () => {
    const result = await maintainerrModule.handlers['maintainerr_get_collection_media'](
      { collectionId: 1 },
      clients
    );
    const data = parse<typeof collectionMediaFixture>(result);
    expect(data).toHaveLength(2);
  });
});

describe('maintainerr_get_collection_media_count', () => {
  it('wraps count in count key', async () => {
    const result = await maintainerrModule.handlers['maintainerr_get_collection_media_count'](
      { collectionId: 1 },
      clients
    );
    const data = parse<{ count: number }>(result);
    expect(data.count).toBe(2);
  });
});

describe('maintainerr_get_collection_logs', () => {
  it('defaults page to 1', async () => {
    await maintainerrModule.handlers['maintainerr_get_collection_logs']({ id: 1 }, clients);
    expect(clients.maintainerr!.getCollectionLogs).toHaveBeenCalledWith(1, 1);
  });
});

describe('maintainerr_update_collections_schedule', () => {
  it('passes cron to client', async () => {
    await maintainerrModule.handlers['maintainerr_update_collections_schedule'](
      { cron: '0 0-23/6 * * *' },
      clients
    );
    expect(clients.maintainerr!.updateCollectionsSchedule).toHaveBeenCalledWith('0 0-23/6 * * *');
  });
});
