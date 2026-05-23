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
  it('only includes provided fields in payload', async () => {
    await maintainerrModule.handlers['maintainerr_update_rule'](
      { id: 1, isActive: false },
      clients
    );
    const call = (clients.maintainerr!.updateRule as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call.id).toBe(1);
    expect(call.isActive).toBe(false);
    expect(call).not.toHaveProperty('name');
    expect(call).not.toHaveProperty('rules');
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
  it('passes libraryId, dataType, and rules to client', async () => {
    const rules = [{ firstVal: [0, 7], action: 5, customVal: { ruleTypeId: 0, value: '63072000' } }];
    await maintainerrModule.handlers['maintainerr_test_rule'](
      { libraryId: 1, dataType: 1, rules },
      clients
    );
    expect(clients.maintainerr!.testRule).toHaveBeenCalledWith(1, 1, rules);
  });
});

describe('maintainerr_add_exclusion', () => {
  it('returns the created exclusion', async () => {
    const result = await maintainerrModule.handlers['maintainerr_add_exclusion'](
      { plexId: 12345, ruleGroupId: 1 },
      clients
    );
    const data = parse<typeof exclusionFixture>(result);
    expect(data.plexId).toBe(12345);
    expect(data.ruleGroupId).toBe(1);
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
  it('returns deleted confirmation with plexId', async () => {
    const result = await maintainerrModule.handlers['maintainerr_delete_media_exclusions'](
      { plexId: 12345 },
      clients
    );
    const data = parse<{ deleted: boolean; plexId: number }>(result);
    expect(data.deleted).toBe(true);
    expect(data.plexId).toBe(12345);
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
