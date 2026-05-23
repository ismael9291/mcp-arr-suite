/**
 * Maintainerr API client.
 *
 * Maintainerr uses a REST API at /api/* with optional X-Api-Key header auth.
 * This client does NOT extend ArrClient — the API pattern is fundamentally different.
 */

export interface MaintainerrConfig {
  url: string;
  apiKey?: string;
}

export class MaintainerrClient {
  private readonly url: string;
  private readonly apiKey?: string;

  constructor(config: MaintainerrConfig) {
    this.url = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.url}/api${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    };
    if (this.apiKey) headers['X-Api-Key'] = this.apiKey;
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Maintainerr API error: ${response.status} ${response.statusText} - ${text}`);
    }
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as unknown as T;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json() as Promise<T>;
    }
    return response.text() as unknown as T;
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async getSettings(): Promise<Record<string, unknown>> {
    return this.request('/settings');
  }

  async updateSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request('/settings', { method: 'POST', body: JSON.stringify(settings) });
  }

  async getVersion(): Promise<unknown> {
    return this.request('/settings/version');
  }

  async checkSetup(): Promise<boolean> {
    return this.request('/settings/test/setup');
  }

  async testPlex(): Promise<unknown> {
    return this.request('/settings/test/plex');
  }

  async testOverseerr(url: string, apiKey: string): Promise<unknown> {
    return this.request('/settings/test/overseerr', {
      method: 'POST',
      body: JSON.stringify({ url, api_key: apiKey }),
    });
  }

  async testSonarr(serverName: string, url: string, apiKey: string): Promise<unknown> {
    return this.request('/settings/test/sonarr', {
      method: 'POST',
      body: JSON.stringify({ serverName, url, apiKey }),
    });
  }

  async testRadarr(serverName: string, url: string, apiKey: string): Promise<unknown> {
    return this.request('/settings/test/radarr', {
      method: 'POST',
      body: JSON.stringify({ serverName, url, apiKey }),
    });
  }

  async testTautulli(url: string, apiKey: string): Promise<unknown> {
    return this.request('/settings/test/tautulli', {
      method: 'POST',
      body: JSON.stringify({ url, api_key: apiKey }),
    });
  }

  async testJellyseerr(url: string, apiKey: string): Promise<unknown> {
    return this.request('/settings/test/jellyseerr', {
      method: 'POST',
      body: JSON.stringify({ url, api_key: apiKey }),
    });
  }

  async getPlexServers(): Promise<unknown[]> {
    return this.request('/settings/plex/devices/servers');
  }

  async setPlexToken(token: string): Promise<unknown> {
    return this.request('/settings/plex/token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async removePlexAuth(): Promise<void> {
    await this.request('/settings/plex/auth', { method: 'DELETE' });
  }

  async validateCron(cron: string): Promise<unknown> {
    return this.request('/settings/cron/validate', {
      method: 'POST',
      body: JSON.stringify({ cron }),
    });
  }

  async regenerateApiKey(): Promise<unknown> {
    return this.request('/settings/api/generate');
  }

  // ── Plex ───────────────────────────────────────────────────────────────────

  async getPlexLibraries(): Promise<unknown[]> {
    return this.request('/plex/libraries');
  }

  async getLibraryContent(libraryId: string, page = 1): Promise<unknown> {
    return this.request(`/plex/library/${libraryId}/content/${page}`);
  }

  async searchLibrary(libraryId: string, query: string): Promise<unknown[]> {
    return this.request(`/plex/library/${libraryId}/content/search/${encodeURIComponent(query)}`);
  }

  async getLibraryCollections(libraryId: string): Promise<unknown[]> {
    return this.request(`/plex/library/${libraryId}/collections`);
  }

  async getPlexCollectionDetails(collectionId: string): Promise<unknown> {
    return this.request(`/plex/library/collection/${collectionId}`);
  }

  async getPlexCollectionChildren(collectionId: string): Promise<unknown[]> {
    return this.request(`/plex/library/collection/${collectionId}/children`);
  }

  async searchPlex(query: string): Promise<unknown[]> {
    return this.request(`/plex/search/${encodeURIComponent(query)}`);
  }

  async getMediaMetadata(plexId: number): Promise<unknown> {
    return this.request(`/plex/meta/${plexId}`);
  }

  async getMediaSeen(plexId: number): Promise<unknown> {
    return this.request(`/plex/meta/${plexId}/seen`);
  }

  async getMediaChildren(plexId: number): Promise<unknown> {
    return this.request(`/plex/meta/${plexId}/children`);
  }

  async getPlexUsers(): Promise<unknown[]> {
    return this.request('/plex/users');
  }

  async createPlexCollection(libraryId: string, title: string, type: number): Promise<unknown> {
    return this.request('/plex/library/collection/create', {
      method: 'POST',
      body: JSON.stringify({ libraryId, title, type }),
    });
  }

  async updatePlexCollectionSettings(
    collectionId: string,
    libraryId: string,
    settings: { recommended?: boolean; ownHome?: boolean; sharedHome?: boolean }
  ): Promise<unknown> {
    return this.request('/plex/library/collection/settings', {
      method: 'PUT',
      body: JSON.stringify({ collectionId, libraryId, ...settings }),
    });
  }

  async addToPlexCollection(collectionId: string, childId: string): Promise<unknown> {
    return this.request(`/plex/library/collection/${collectionId}/child/${childId}`, { method: 'PUT' });
  }

  async removeFromPlexCollection(collectionId: string, childId: string): Promise<unknown> {
    return this.request(`/plex/library/collection/${collectionId}/child/${childId}`, { method: 'DELETE' });
  }

  async deletePlexCollection(collectionId: string): Promise<void> {
    await this.request(`/plex/library/collection/${collectionId}`, { method: 'DELETE' });
  }

  // ── Rules ──────────────────────────────────────────────────────────────────

  async getRuleConstants(): Promise<unknown> {
    return this.request('/rules/constants');
  }

  async getRules(): Promise<unknown[]> {
    return this.request('/rules');
  }

  async getRuleCount(): Promise<number> {
    const result = await this.request<string>('/rules/count');
    return Number(result);
  }

  async getRule(id: number): Promise<unknown> {
    return this.request(`/rules/${id}`);
  }

  async createRule(rule: Record<string, unknown>): Promise<unknown> {
    return this.request('/rules', { method: 'POST', body: JSON.stringify(rule) });
  }

  async updateRule(rule: Record<string, unknown>): Promise<unknown> {
    return this.request('/rules', { method: 'PUT', body: JSON.stringify(rule) });
  }

  async deleteRule(id: number): Promise<void> {
    await this.request(`/rules/${id}`, { method: 'DELETE' });
  }

  async executeRules(): Promise<unknown> {
    return this.request('/rules/execute', { method: 'POST', body: JSON.stringify({}) });
  }

  async stopRules(): Promise<unknown> {
    return this.request('/rules/execute/stop', { method: 'POST', body: JSON.stringify({}) });
  }

  async testRule(libraryId: number, dataType: number, rules: unknown[]): Promise<unknown> {
    return this.request('/rules/test', {
      method: 'POST',
      body: JSON.stringify({ libraryId, dataType, rules }),
    });
  }

  async addExclusion(plexId: number, ruleGroupId: number): Promise<unknown> {
    return this.request('/rules/exclusion', {
      method: 'POST',
      body: JSON.stringify({ plexId, ruleGroupId }),
    });
  }

  async getExclusions(): Promise<unknown[]> {
    return this.request('/rules/exclusion');
  }

  async deleteExclusion(id: number): Promise<void> {
    await this.request(`/rules/exclusion/${id}`, { method: 'DELETE' });
  }

  async deleteExclusionsForMedia(plexId: number): Promise<void> {
    await this.request(`/rules/exclusions/${plexId}`, { method: 'DELETE' });
  }

  async getCommunityRules(page = 1, limit = 10, typeId = 1): Promise<unknown> {
    return this.request(`/rules/community?page=${page}&limit=${limit}&typeId=${typeId}`);
  }

  async updateRulesSchedule(cron: string): Promise<unknown> {
    return this.request('/rules/schedule/update', { method: 'PUT', body: JSON.stringify({ cron }) });
  }

  // ── Collections ────────────────────────────────────────────────────────────

  async getCollections(): Promise<unknown[]> {
    return this.request('/collections');
  }

  async getCollection(id: number): Promise<unknown> {
    return this.request(`/collections/collection/${id}`);
  }

  async updateCollection(collection: Record<string, unknown>): Promise<unknown> {
    return this.request('/collections', { method: 'PUT', body: JSON.stringify(collection) });
  }

  async triggerCollectionHandler(): Promise<unknown> {
    return this.request('/collections/handle', { method: 'POST', body: JSON.stringify({}) });
  }

  async activateCollection(id: number): Promise<unknown> {
    return this.request(`/collections/activate/${id}`);
  }

  async deactivateCollection(id: number): Promise<unknown> {
    return this.request(`/collections/deactivate/${id}`);
  }

  async getCollectionMedia(collectionId: number): Promise<unknown[]> {
    return this.request(`/collections/media?collectionId=${collectionId}`);
  }

  async getCollectionMediaCount(collectionId: number): Promise<number> {
    const result = await this.request<string>(`/collections/media/count?collectionId=${collectionId}`);
    return Number(result);
  }

  async addToCollection(collectionId: number, plexId: number): Promise<unknown> {
    return this.request('/collections/media/add', {
      method: 'POST',
      body: JSON.stringify({ collectionId, plexId }),
    });
  }

  async removeFromCollection(collectionId: number, plexId: number): Promise<unknown> {
    return this.request('/collections/media', {
      method: 'DELETE',
      body: JSON.stringify({ collectionId, plexId }),
    });
  }

  async getCollectionLogs(id: number, page = 1): Promise<unknown> {
    return this.request(`/collections/logs/${id}/content/${page}`);
  }

  async getCollectionExclusions(id: number, page = 1): Promise<unknown> {
    return this.request(`/collections/exclusions/${id}/content/${page}`);
  }

  async updateCollectionsSchedule(cron: string): Promise<unknown> {
    return this.request('/collections/schedule/update', {
      method: 'PUT',
      body: JSON.stringify({ cron }),
    });
  }
}
