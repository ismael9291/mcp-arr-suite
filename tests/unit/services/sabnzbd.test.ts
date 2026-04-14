import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { sabnzbdModule } from '../../../src/services/sabnzbd.js';
import { SabnzbdClient } from '../../../src/clients/sabnzbd-client.js';
import { mswServer } from '../../setup.js';
import {
  queueFixture,
  historyFixture,
  statusFixture,
  serverStatsFixture,
  categoriesFixture,
  scriptsFixture,
  warningsFixture,
  filesFixture,
} from '../../fixtures/sabnzbd/queue.js';

const BASE = 'http://sabnzbd.test';
const API_KEY = 'testkey';
const API = `${BASE}/api`;

let sabnzbdClient: SabnzbdClient;
let clients: { sabnzbd: SabnzbdClient };

/** Match any SABnzbd API call with a given mode */
function apiUrl(mode: string) {
  return new URLPattern({ pathname: '/api', search: `*mode=${mode}*` });
}

beforeEach(() => {
  sabnzbdClient = new SabnzbdClient(BASE, API_KEY);
  clients = { sabnzbd: sabnzbdClient };
});

// ─── sabnzbd_get_queue ────────────────────────────────────────────────────────

describe('sabnzbd_get_queue', () => {
  beforeEach(() => {
    mswServer.use(http.get(API, () => HttpResponse.json(queueFixture)));
  });

  it('returns queue envelope fields at top level', async () => {
    const result = await sabnzbdModule.handlers['sabnzbd_get_queue']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe('Downloading');
    expect(data.speed).toBe('12.5 MB/s');
    expect(data.paused).toBe(false);
  });

  it('returns paginated items with expected fields', async () => {
    const result = await sabnzbdModule.handlers['sabnzbd_get_queue']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(2);
    expect(data.items).toHaveLength(2);
    const item = data.items[0];
    expect(item.nzo_id).toBe('SABnzb001');
    expect(item.filename).toBe('Show.S01E01.1080p.BluRay.x264');
    expect(item.cat).toBe('tv');
    expect(typeof item.percentage).toBe('number');
  });

  it('passes limit and offset as start/limit params', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json(queueFixture);
    }));
    await sabnzbdModule.handlers['sabnzbd_get_queue']({ limit: 10, offset: 5 }, clients);
    expect(capturedUrl).toContain('limit=10');
    expect(capturedUrl).toContain('start=5');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_get_queue']({}, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_get_history ──────────────────────────────────────────────────────

describe('sabnzbd_get_history', () => {
  beforeEach(() => {
    mswServer.use(http.get(API, () => HttpResponse.json(historyFixture)));
  });

  it('returns paginated history with converted completed timestamp', async () => {
    const result = await sabnzbdModule.handlers['sabnzbd_get_history']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(3);
    expect(data.items).toHaveLength(3);
    expect(data.items[0].nzo_id).toBe('SABnzb100');
    expect(data.items[0].status).toBe('Completed');
    expect(typeof data.items[0].completed).toBe('string');
  });

  it('includes failMessage only when non-empty', async () => {
    const result = await sabnzbdModule.handlers['sabnzbd_get_history']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.items[0]).not.toHaveProperty('failMessage');
    expect(data.items[1].failMessage).toBe('Repair failed');
  });

  it('passes failedOnly as failed_only=1', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json(historyFixture);
    }));
    await sabnzbdModule.handlers['sabnzbd_get_history']({ failedOnly: true }, clients);
    expect(capturedUrl).toContain('failed_only=1');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_get_history']({}, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_retry ────────────────────────────────────────────────────────────

describe('sabnzbd_retry', () => {
  it('calls retry mode and returns nzo_id', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_retry']({ nzo_id: 'SABnzb101' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.nzo_id).toBe('SABnzb101');
    expect(capturedUrl).toContain('mode=retry');
    expect(capturedUrl).toContain('value=SABnzb101');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_retry']({ nzo_id: 'x' }, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_retry_all ────────────────────────────────────────────────────────

describe('sabnzbd_retry_all', () => {
  it('calls retry_all mode', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_retry_all']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(capturedUrl).toContain('mode=retry_all');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_retry_all']({}, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_delete ───────────────────────────────────────────────────────────

describe('sabnzbd_delete', () => {
  it('calls queue delete with value and del_files=0 by default', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_delete']({ target: 'queue', value: 'SABnzb001' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.target).toBe('queue');
    expect(data.filesDeleted).toBe(false);
    expect(capturedUrl).toContain('mode=queue');
    expect(capturedUrl).toContain('name=delete');
    expect(capturedUrl).toContain('del_files=0');
  });

  it('passes del_files=1 when deleteFiles is true', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    await sabnzbdModule.handlers['sabnzbd_delete']({ target: 'history', value: 'failed', deleteFiles: true }, clients);
    expect(capturedUrl).toContain('del_files=1');
    expect(capturedUrl).toContain('mode=history');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_delete']({ target: 'queue', value: 'all' }, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_get_status ───────────────────────────────────────────────────────

describe('sabnzbd_get_status', () => {
  beforeEach(() => {
    mswServer.use(http.get(API, () => HttpResponse.json(statusFixture)));
  });

  it('returns trimmed status fields', async () => {
    const result = await sabnzbdModule.handlers['sabnzbd_get_status']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.version).toBe('4.3.1');
    expect(data.paused).toBe(false);
    expect(data.completedir).toBe('/downloads/complete');
    expect(data.logfile).toBe('/config/logs/sabnzbd.log');
  });

  it('passes skip_dashboard=1', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json(statusFixture);
    }));
    await sabnzbdModule.handlers['sabnzbd_get_status']({}, clients);
    expect(capturedUrl).toContain('skip_dashboard=1');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_get_status']({}, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_unblock_server ───────────────────────────────────────────────────

describe('sabnzbd_unblock_server', () => {
  it('calls unblock_server with correct params', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_unblock_server']({ server: 'news.example.com' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.server).toBe('news.example.com');
    expect(capturedUrl).toContain('name=unblock_server');
    expect(capturedUrl).toContain('value=news.example.com');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_unblock_server']({ server: 'x' }, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_add_url ──────────────────────────────────────────────────────────

describe('sabnzbd_add_url', () => {
  it('calls addurl with required and optional params', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true, nzo_ids: ['SABnzb999'] });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_add_url']({
      url: 'http://example.com/test.nzb',
      name: 'Test Show',
      category: 'tv',
      priority: 1,
    }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.nzo_ids).toEqual(['SABnzb999']);
    expect(capturedUrl).toContain('mode=addurl');
    expect(capturedUrl).toContain('cat=tv');
    expect(capturedUrl).toContain('priority=1');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_add_url']({ url: 'http://x.com/a.nzb' }, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_get_cats ─────────────────────────────────────────────────────────

describe('sabnzbd_get_cats', () => {
  beforeEach(() => {
    mswServer.use(http.get(API, () => HttpResponse.json(categoriesFixture)));
  });

  it('returns all categories with count', async () => {
    const result = await sabnzbdModule.handlers['sabnzbd_get_cats']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(3);
    expect(data.categories[0].name).toBe('tv');
    expect(data.categories[0].dir).toBe('/downloads/tv');
  });

  it('omits empty dir fields', async () => {
    const result = await sabnzbdModule.handlers['sabnzbd_get_cats']({}, clients);
    const data = JSON.parse(result.content[0].text);
    const star = data.categories.find((c: { name: string }) => c.name === '*');
    expect(star).not.toHaveProperty('dir');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_get_cats']({}, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_get_scripts ──────────────────────────────────────────────────────

describe('sabnzbd_get_scripts', () => {
  it('returns script list with count', async () => {
    mswServer.use(http.get(API, () => HttpResponse.json(scriptsFixture)));
    const result = await sabnzbdModule.handlers['sabnzbd_get_scripts']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(2);
    expect(data.scripts).toContain('cleanup.py');
    expect(data.scripts).toContain('notify.sh');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_get_scripts']({}, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_server_stats ─────────────────────────────────────────────────────

describe('sabnzbd_server_stats', () => {
  it('returns formatted byte totals and per-server stats', async () => {
    mswServer.use(http.get(API, () => HttpResponse.json(serverStatsFixture)));
    const result = await sabnzbdModule.handlers['sabnzbd_server_stats']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBeDefined();
    expect(data.total.day).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
    expect(data.total.total).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
    expect(data.servers).toHaveLength(1);
    expect(data.servers[0].name).toBe('news.example.com');
    expect(data.servers[0].day).toMatch(/\d+(\.\d+)? (B|KB|MB|GB|TB)/);
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_server_stats']({}, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_pause / sabnzbd_resume ──────────────────────────────────────────

describe('sabnzbd_pause', () => {
  it('pauses entire queue when no nzo_id given', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_pause']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.scope).toBe('queue');
    expect(data.nzo_id).toBeNull();
    expect(capturedUrl).toContain('mode=pause');
    expect(capturedUrl).not.toContain('name=pause');
  });

  it('pauses single job when nzo_id given', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_pause']({ nzo_id: 'SABnzb001' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.scope).toBe('job');
    expect(data.nzo_id).toBe('SABnzb001');
    expect(capturedUrl).toContain('name=pause');
    expect(capturedUrl).toContain('value=SABnzb001');
  });
});

describe('sabnzbd_resume', () => {
  it('resumes entire queue when no nzo_id given', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_resume']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.scope).toBe('queue');
    expect(capturedUrl).toContain('mode=resume');
    expect(capturedUrl).not.toContain('name=resume');
  });
});

// ─── sabnzbd_pause_pp / sabnzbd_resume_pp ────────────────────────────────────

describe('sabnzbd_pause_pp', () => {
  it('calls pause_pp mode', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_pause_pp']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(capturedUrl).toContain('mode=pause_pp');
  });
});

describe('sabnzbd_resume_pp', () => {
  it('calls resume_pp mode', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_resume_pp']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(capturedUrl).toContain('mode=resume_pp');
  });
});

// ─── sabnzbd_set_priority ─────────────────────────────────────────────────────

describe('sabnzbd_set_priority', () => {
  it('maps string priority to integer and calls correct params', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_set_priority']({ nzo_id: 'SABnzb001', priority: 'high' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.priority).toBe('high');
    expect(capturedUrl).toContain('name=priority');
    expect(capturedUrl).toContain('value2=1');
  });

  it('maps force to 2 and paused to -2', async () => {
    const results: string[] = [];
    mswServer.use(http.get(API, ({ request }) => {
      results.push(request.url);
      return HttpResponse.json({ status: true });
    }));
    await sabnzbdModule.handlers['sabnzbd_set_priority']({ nzo_id: 'x', priority: 'force' }, clients);
    await sabnzbdModule.handlers['sabnzbd_set_priority']({ nzo_id: 'x', priority: 'paused' }, clients);
    expect(results[0]).toContain('value2=2');
    expect(results[1]).toContain('value2=-2');
  });

  it('throws for unknown priority string', async () => {
    mswServer.use(http.get(API, () => HttpResponse.json({ status: true })));
    await expect(sabnzbdModule.handlers['sabnzbd_set_priority']({ nzo_id: 'x', priority: 'turbo' }, clients)).rejects.toThrow('Unknown priority');
  });
});

// ─── sabnzbd_set_speed_limit ──────────────────────────────────────────────────

describe('sabnzbd_set_speed_limit', () => {
  it('calls config speedlimit with value', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_set_speed_limit']({ value: '50M' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.limit).toBe('50M');
    expect(capturedUrl).toContain('name=speedlimit');
    expect(capturedUrl).toContain('value=50M');
  });
});

// ─── sabnzbd_change_cat ───────────────────────────────────────────────────────

describe('sabnzbd_change_cat', () => {
  it('calls change_cat with nzo_id and category', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_change_cat']({ nzo_id: 'SABnzb001', category: 'movies' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.category).toBe('movies');
    expect(capturedUrl).toContain('mode=change_cat');
    expect(capturedUrl).toContain('value2=movies');
  });
});

// ─── sabnzbd_change_opts ──────────────────────────────────────────────────────

describe('sabnzbd_change_opts', () => {
  it('calls change_opts with pp value', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_change_opts']({ nzo_id: 'SABnzb001', pp: 2 }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.pp).toBe(2);
    expect(capturedUrl).toContain('mode=change_opts');
    expect(capturedUrl).toContain('value2=2');
  });
});

// ─── sabnzbd_mark_completed ───────────────────────────────────────────────────

describe('sabnzbd_mark_completed', () => {
  it('marks job as completed', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_mark_completed']({ nzo_id: 'SABnzb101' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.nzo_id).toBe('SABnzb101');
    expect(capturedUrl).toContain('name=mark_as_completed');
  });
});

// ─── sabnzbd_delete_orphans ───────────────────────────────────────────────────

describe('sabnzbd_delete_orphans', () => {
  it('calls delete_all_orphan', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_delete_orphans']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(capturedUrl).toContain('name=delete_all_orphan');
  });
});

// ─── sabnzbd_add_orphans ──────────────────────────────────────────────────────

describe('sabnzbd_add_orphans', () => {
  it('calls add_all_orphan', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_add_orphans']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(capturedUrl).toContain('name=add_all_orphan');
  });
});

// ─── sabnzbd_purge_failed ─────────────────────────────────────────────────────

describe('sabnzbd_purge_failed', () => {
  it('deletes history with value=failed and del_files=1', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_purge_failed']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(capturedUrl).toContain('value=failed');
    expect(capturedUrl).toContain('del_files=1');
  });
});

// ─── sabnzbd_get_warnings ─────────────────────────────────────────────────────

describe('sabnzbd_get_warnings', () => {
  it('returns warnings list with count', async () => {
    mswServer.use(http.get(API, () => HttpResponse.json(warningsFixture)));
    const result = await sabnzbdModule.handlers['sabnzbd_get_warnings']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(2);
    expect(data.warnings).toHaveLength(2);
  });

  it('clears warnings when clear: true', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_get_warnings']({ clear: true }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(capturedUrl).toContain('name=clear');
  });
});

// ─── sabnzbd_get_files ────────────────────────────────────────────────────────

describe('sabnzbd_get_files', () => {
  it('returns file list for a job', async () => {
    mswServer.use(http.get(API, () => HttpResponse.json(filesFixture)));
    const result = await sabnzbdModule.handlers['sabnzbd_get_files']({ nzo_id: 'SABnzb001' }, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.nzo_id).toBe('SABnzb001');
    expect(data.count).toBe(2);
    expect(data.files[0].filename).toBe('show.s01e01.part01.rar');
    expect(typeof data.files[0].mbleft).toBe('number');
  });

  it('throws when sabnzbd is not configured', async () => {
    await expect(sabnzbdModule.handlers['sabnzbd_get_files']({ nzo_id: 'x' }, {})).rejects.toThrow('SABnzbd is not configured');
  });
});

// ─── sabnzbd_version ──────────────────────────────────────────────────────────

describe('sabnzbd_version', () => {
  it('returns version string', async () => {
    mswServer.use(http.get(API, () => HttpResponse.json({ version: '4.3.1' })));
    const result = await sabnzbdModule.handlers['sabnzbd_version']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.version).toBe('4.3.1');
  });
});

// ─── sabnzbd_rss_now ──────────────────────────────────────────────────────────

describe('sabnzbd_rss_now', () => {
  it('calls rss_now mode', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_rss_now']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(capturedUrl).toContain('mode=rss_now');
  });
});

// ─── sabnzbd_watched_now ──────────────────────────────────────────────────────

describe('sabnzbd_watched_now', () => {
  it('calls watched_now mode', async () => {
    let capturedUrl: string | undefined;
    mswServer.use(http.get(API, ({ request }) => {
      capturedUrl = request.url;
      return HttpResponse.json({ status: true });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_watched_now']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(capturedUrl).toContain('mode=watched_now');
  });
});

// ─── sabnzbd_get_paths ────────────────────────────────────────────────────────

describe('sabnzbd_get_paths', () => {
  it('merges dir fields from misc config with category paths', async () => {
    mswServer.use(http.get(API, ({ request }) => {
      const url = new URL(request.url);
      const section = url.searchParams.get('section');
      if (section === 'misc') {
        return HttpResponse.json({
          config: {
            misc: {
              complete_dir: '/downloads/complete',
              download_dir: '/downloads/incomplete',
              script_dir: '/config/scripts',
              log_dir: '/config/logs',
              version: '4.3.1',
            },
          },
        });
      }
      return HttpResponse.json({
        config: {
          categories: [
            { name: 'tv', dir: '/downloads/tv' },
            { name: 'movies', dir: '' },
          ],
        },
      });
    }));
    const result = await sabnzbdModule.handlers['sabnzbd_get_paths']({}, clients);
    const data = JSON.parse(result.content[0].text);
    expect(data.complete_dir).toBe('/downloads/complete');
    expect(data.download_dir).toBe('/downloads/incomplete');
    expect(data).not.toHaveProperty('version');
    expect(data.categories).toHaveLength(2);
    expect(data.categories[0].name).toBe('tv');
  });
});
