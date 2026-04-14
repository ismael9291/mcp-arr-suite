/**
 * SABnzbd API client.
 *
 * SABnzbd uses a flat query-string API: GET /api?apikey=...&output=json&mode=<mode>&...params
 * This client does NOT extend ArrClient — the API pattern is fundamentally different.
 */

export class SabnzbdClient {
  constructor(
    private readonly url: string,
    private readonly apiKey: string
  ) {}

  async call<T = Record<string, unknown>>(mode: string, params?: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams({ apikey: this.apiKey, output: 'json', mode, ...params });
    const res = await fetch(`${this.url}/api?${qs.toString()}`);
    if (!res.ok) throw new Error(`SABnzbd API error: ${res.status} ${res.statusText}`);
    const json = await res.json() as Record<string, unknown>;
    if (json.status === false) {
      throw new Error(`SABnzbd error: ${String(json.error ?? 'unknown error')}`);
    }
    return json as T;
  }

  // ── Queue ──────────────────────────────────────────────────────────────────

  async getQueue(start = 0, limit = 25, search?: string): Promise<SabnzbdQueueResponse> {
    const params: Record<string, string> = { start: String(start), limit: String(limit) };
    if (search) params.search = search;
    return this.call<SabnzbdQueueResponse>('queue', params);
  }

  async getHistory(start = 0, limit = 25, search?: string, category?: string, failedOnly = false): Promise<SabnzbdHistoryResponse> {
    const params: Record<string, string> = {
      start: String(start),
      limit: String(limit),
      failed_only: failedOnly ? '1' : '0',
    };
    if (search) params.search = search;
    if (category) params.category = category;
    return this.call<SabnzbdHistoryResponse>('history', params);
  }

  async retry(nzoId: string): Promise<{ status: boolean }> {
    return this.call('retry', { value: nzoId });
  }

  async retryAll(): Promise<{ status: boolean }> {
    return this.call('retry_all');
  }

  async deleteQueue(value: string, deleteFiles = false): Promise<{ status: boolean }> {
    return this.call('queue', { name: 'delete', value, del_files: deleteFiles ? '1' : '0' });
  }

  async deleteHistory(value: string, deleteFiles = false): Promise<{ status: boolean }> {
    return this.call('history', { name: 'delete', value, del_files: deleteFiles ? '1' : '0' });
  }

  async getStatus(): Promise<SabnzbdStatusResponse> {
    return this.call<SabnzbdStatusResponse>('status', { skip_dashboard: '1' });
  }

  async unblockServer(server: string): Promise<{ status: boolean }> {
    return this.call('status', { name: 'unblock_server', value: server });
  }

  async addUrl(url: string, name?: string, category?: string, priority?: number, pp?: number): Promise<{ status: boolean; nzo_ids: string[] }> {
    const params: Record<string, string> = { name: url };
    if (name) params.nzbname = name;
    if (category) params.cat = category;
    if (priority !== undefined) params.priority = String(priority);
    if (pp !== undefined) params.pp = String(pp);
    return this.call('addurl', params);
  }

  async getCategories(): Promise<{ categories: SabnzbdCategory[] }> {
    return this.call('get_cats');
  }

  async getScripts(): Promise<{ scripts: string[] }> {
    return this.call('get_scripts');
  }

  async getServerStats(): Promise<SabnzbdServerStatsResponse> {
    return this.call<SabnzbdServerStatsResponse>('server_stats');
  }

  // ── Job control ────────────────────────────────────────────────────────────

  async pauseQueue(nzoId?: string): Promise<{ status: boolean }> {
    if (nzoId) return this.call('queue', { name: 'pause', value: nzoId });
    return this.call('pause');
  }

  async resumeQueue(nzoId?: string): Promise<{ status: boolean }> {
    if (nzoId) return this.call('queue', { name: 'resume', value: nzoId });
    return this.call('resume');
  }

  async pausePostProcessing(): Promise<{ status: boolean }> {
    return this.call('pause_pp');
  }

  async resumePostProcessing(): Promise<{ status: boolean }> {
    return this.call('resume_pp');
  }

  async setPriority(nzoId: string, priority: number): Promise<{ status: boolean }> {
    return this.call('queue', { name: 'priority', value: nzoId, value2: String(priority) });
  }

  async setSpeedLimit(value: string): Promise<{ status: boolean }> {
    return this.call('config', { name: 'speedlimit', value });
  }

  async changeCategory(nzoId: string, category: string): Promise<{ status: boolean }> {
    return this.call('change_cat', { value: nzoId, value2: category });
  }

  async changePostProcessing(nzoId: string, pp: number): Promise<{ status: boolean }> {
    return this.call('change_opts', { value: nzoId, value2: String(pp) });
  }

  async markCompleted(nzoId: string): Promise<{ status: boolean }> {
    return this.call('history', { name: 'mark_as_completed', value: nzoId });
  }

  // ── Orphan & cleanup ───────────────────────────────────────────────────────

  async deleteOrphans(): Promise<{ status: boolean }> {
    return this.call('status', { name: 'delete_all_orphan' });
  }

  async addOrphans(): Promise<{ status: boolean }> {
    return this.call('status', { name: 'add_all_orphan' });
  }

  async purgeFailed(): Promise<{ status: boolean }> {
    return this.call('history', { name: 'delete', value: 'failed', del_files: '1' });
  }

  // ── Diagnostics ────────────────────────────────────────────────────────────

  async getWarnings(clear = false): Promise<{ warnings: SabnzbdWarning[] } | { status: boolean }> {
    if (clear) return this.call('warnings', { name: 'clear' });
    return this.call('warnings');
  }

  async getPaths(): Promise<{ misc: Record<string, string> }> {
    return this.call('get_config', { section: 'misc' });
  }

  async getCategoryPaths(): Promise<{ categories: SabnzbdCategory[] }> {
    return this.call('get_config', { section: 'categories' });
  }

  async getFiles(nzoId: string): Promise<SabnzbdFilesResponse> {
    return this.call<SabnzbdFilesResponse>('get_files', { value: nzoId });
  }

  async getVersion(): Promise<{ version: string }> {
    return this.call('version');
  }

  async rssNow(): Promise<{ status: boolean }> {
    return this.call('rss_now');
  }

  async watchedNow(): Promise<{ status: boolean }> {
    return this.call('watched_now');
  }
}

// ── Response types ─────────────────────────────────────────────────────────────

export interface SabnzbdQueueItem {
  nzo_id: string;
  filename: string;
  cat: string;
  size: string;
  sizeleft: string;
  percentage: string;
  status: string;
  timeleft: string;
  priority: string;
}

export interface SabnzbdQueueEnvelope {
  status: string;
  speed: string;
  sizeleft: string;
  paused: boolean;
  noofslots: number;
  slots: SabnzbdQueueItem[];
}

export interface SabnzbdQueueResponse {
  queue: SabnzbdQueueEnvelope;
}

export interface SabnzbdHistoryItem {
  nzo_id: string;
  name: string;
  cat: string;
  size: string;
  status: string;
  fail_message: string;
  completed: number;
  stage_log?: Array<{ name: string; actions: string[] }>;
}

export interface SabnzbdHistoryEnvelope {
  noofslots: number;
  slots: SabnzbdHistoryItem[];
}

export interface SabnzbdHistoryResponse {
  history: SabnzbdHistoryEnvelope;
}

export interface SabnzbdStatusResponse {
  version?: string;
  status?: string;
  paused?: boolean;
  speed?: string;
  speedlimit?: string;
  diskspace1?: string;
  diskspace2?: string;
  diskspacetotal1?: string;
  diskspacetotal2?: string;
  completedir?: string;
  downloaddir?: string;
  logfile?: string;
  loglevel?: string;
  loadavg?: string;
  [key: string]: unknown;
}

export interface SabnzbdCategory {
  name: string;
  dir?: string;
  pp?: string;
  script?: string;
  priority?: string | number;
}

export interface SabnzbdServerStatsResponse {
  day?: number;
  week?: number;
  month?: number;
  total?: number;
  servers?: Record<string, { day: number; week: number; month: number; total: number }>;
  [key: string]: unknown;
}

export interface SabnzbdWarning {
  type: string;
  time: string;
  text: string;
}

export interface SabnzbdFileItem {
  id: string;
  filename: string;
  mbleft: number;
  mb: number;
  status: string;
}

export interface SabnzbdFilesResponse {
  files: SabnzbdFileItem[];
}
