/**
 * SABnzbd ToolModule
 *
 * All tools for interacting with SABnzbd's flat query-string API.
 * The client (SabnzbdClient) does not extend ArrClient.
 */

import type { ToolModule } from '../types.js';
import { ok } from '../types.js';
import { formatBytes, paginate } from '../shared/formatting.js';

const PRIORITY_MAP: Record<string, number> = {
  paused: -2,
  low: -1,
  normal: 0,
  high: 1,
  force: 2,
};

export const sabnzbdModule: ToolModule = {
  tools: [
    // ── High priority — core queue & failure management ─────────────────────

    {
      name: 'sabnzbd_get_queue',
      description: 'Get the SABnzbd download queue with current speed, size remaining, and per-job status.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number', description: 'Max items to return (default: 25)' },
          offset: { type: 'number', description: 'Offset for pagination (default: 0)' },
          search: { type: 'string', description: 'Filter queue by filename' },
        },
        required: [],
      },
    },
    {
      name: 'sabnzbd_get_history',
      description: 'Get SABnzbd download history. Supports filtering by search term, category, or failed-only.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number', description: 'Max items to return (default: 25)' },
          offset: { type: 'number', description: 'Offset for pagination (default: 0)' },
          search: { type: 'string', description: 'Filter by filename' },
          category: { type: 'string', description: 'Filter by category (e.g. tv, movies)' },
          failedOnly: { type: 'boolean', description: 'Only return failed downloads (default: false)' },
        },
        required: [],
      },
    },
    {
      name: 'sabnzbd_retry',
      description: 'Retry a failed SABnzbd download by its NZO ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          nzo_id: { type: 'string', description: 'NZO ID of the failed job (from sabnzbd_get_history)' },
        },
        required: ['nzo_id'],
      },
    },
    {
      name: 'sabnzbd_retry_all',
      description: 'Retry all failed SABnzbd downloads at once.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_delete',
      description: 'Delete a job (or all jobs matching a filter) from the SABnzbd queue or history.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          target: { type: 'string', enum: ['queue', 'history'], description: 'Where to delete from' },
          value: { type: 'string', description: 'NZO ID to delete, "all" to delete everything, or "failed" (history only) to delete all failed' },
          deleteFiles: { type: 'boolean', description: 'Also delete downloaded files from disk (default: false)' },
        },
        required: ['target', 'value'],
      },
    },
    {
      name: 'sabnzbd_get_status',
      description: 'Get SABnzbd system status: version, speed, disk space, pause state, and configured paths.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_unblock_server',
      description: 'Unblock a news server that SABnzbd has temporarily blocked due to too many errors.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          server: { type: 'string', description: 'Server hostname as shown in SABnzbd config (e.g. news.example.com)' },
        },
        required: ['server'],
      },
    },

    // ── High priority — arr integration ────────────────────────────────────

    {
      name: 'sabnzbd_add_url',
      description: 'Add an NZB from a URL to the SABnzbd queue.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'URL of the NZB file to add' },
          name: { type: 'string', description: 'Display name for the job' },
          category: { type: 'string', description: 'Category to assign (e.g. tv, movies)' },
          priority: { type: 'number', description: 'Priority: -2=paused, -1=low, 0=normal, 1=high, 2=force' },
          pp: { type: 'number', description: 'Post-processing: 0=download only, 1=+repair, 2=+unpack, 3=+delete' },
        },
        required: ['url'],
      },
    },
    {
      name: 'sabnzbd_get_cats',
      description: 'List all configured SABnzbd categories with their directories and settings.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_get_scripts',
      description: 'List all post-processing scripts available in SABnzbd.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_server_stats',
      description: 'Get SABnzbd download volume statistics (day/week/month/total) per server.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },

    // ── Medium priority — job control ──────────────────────────────────────

    {
      name: 'sabnzbd_pause',
      description: 'Pause the entire SABnzbd queue, or pause a single job by NZO ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          nzo_id: { type: 'string', description: 'NZO ID to pause (omit to pause the entire queue)' },
        },
        required: [],
      },
    },
    {
      name: 'sabnzbd_resume',
      description: 'Resume the entire SABnzbd queue, or resume a single paused job by NZO ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          nzo_id: { type: 'string', description: 'NZO ID to resume (omit to resume the entire queue)' },
        },
        required: [],
      },
    },
    {
      name: 'sabnzbd_pause_pp',
      description: 'Pause SABnzbd post-processing (repair/unpack/delete steps will be held).',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_resume_pp',
      description: 'Resume SABnzbd post-processing.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_set_priority',
      description: 'Change the download priority of a queued SABnzbd job.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          nzo_id: { type: 'string', description: 'NZO ID (from sabnzbd_get_queue)' },
          priority: { type: 'string', enum: ['paused', 'low', 'normal', 'high', 'force'], description: 'New priority level' },
        },
        required: ['nzo_id', 'priority'],
      },
    },
    {
      name: 'sabnzbd_set_speed_limit',
      description: 'Set the SABnzbd download speed limit. Pass "0" to disable.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          value: { type: 'string', description: 'Speed limit value, e.g. "50M", "500K", "75%" or "0" to disable' },
        },
        required: ['value'],
      },
    },
    {
      name: 'sabnzbd_change_cat',
      description: 'Change the category of a queued SABnzbd job.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          nzo_id: { type: 'string', description: 'NZO ID (from sabnzbd_get_queue)' },
          category: { type: 'string', description: 'New category name (from sabnzbd_get_cats)' },
        },
        required: ['nzo_id', 'category'],
      },
    },
    {
      name: 'sabnzbd_change_opts',
      description: 'Change the post-processing options for a queued SABnzbd job.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          nzo_id: { type: 'string', description: 'NZO ID (from sabnzbd_get_queue)' },
          pp: { type: 'number', enum: [0, 1, 2, 3], description: '0=download only, 1=+repair, 2=+unpack, 3=+delete' },
        },
        required: ['nzo_id', 'pp'],
      },
    },
    {
      name: 'sabnzbd_mark_completed',
      description: 'Mark a failed history entry as completed (clears the failure without re-downloading).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          nzo_id: { type: 'string', description: 'NZO ID of the history entry (from sabnzbd_get_history)' },
        },
        required: ['nzo_id'],
      },
    },

    // ── Medium priority — orphan & cleanup recovery ────────────────────────

    {
      name: 'sabnzbd_delete_orphans',
      description: 'Delete all orphaned incomplete folders from the SABnzbd download directory.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_add_orphans',
      description: 'Re-queue all orphaned incomplete jobs found in the SABnzbd download directory.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_purge_failed',
      description: 'Delete all failed history entries and their files from SABnzbd.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },

    // ── Low priority — diagnostics, paths & info ───────────────────────────

    {
      name: 'sabnzbd_get_warnings',
      description: 'Get active SABnzbd warnings, or clear them.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          clear: { type: 'boolean', description: 'Clear all warnings instead of listing them (default: false)' },
        },
        required: [],
      },
    },
    {
      name: 'sabnzbd_get_paths',
      description: 'Get all configured directory paths in SABnzbd (complete dir, download dir, scripts, etc.) plus per-category paths.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_get_files',
      description: 'List the individual files inside a queued SABnzbd job.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          nzo_id: { type: 'string', description: 'NZO ID (from sabnzbd_get_queue)' },
        },
        required: ['nzo_id'],
      },
    },
    {
      name: 'sabnzbd_version',
      description: 'Get the SABnzbd application version.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_rss_now',
      description: 'Trigger an immediate RSS feed refresh in SABnzbd.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'sabnzbd_watched_now',
      description: 'Trigger an immediate scan of the SABnzbd watched folder.',
      inputSchema: { type: 'object' as const, properties: {}, required: [] },
    },
  ],

  handlers: {
    // ── High priority — core queue & failure management ─────────────────────

    sabnzbd_get_queue: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const limit = (args.limit as number | undefined) ?? 25;
      const offset = (args.offset as number | undefined) ?? 0;
      const search = args.search as string | undefined;
      const res = await clients.sabnzbd.getQueue(offset, limit, search);
      const q = res.queue;
      return ok({
        status: q.status,
        speed: q.speed,
        sizeLeft: q.sizeleft,
        paused: q.paused,
        ...paginate(
          q.slots.map(s => ({
            nzo_id: s.nzo_id,
            filename: s.filename,
            cat: s.cat,
            size: s.size,
            sizeLeft: s.sizeleft,
            percentage: Number(s.percentage),
            status: s.status,
            timeleft: s.timeleft,
            priority: s.priority,
          })),
          q.noofslots,
          offset,
          limit
        ),
      });
    },

    sabnzbd_get_history: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const limit = (args.limit as number | undefined) ?? 25;
      const offset = (args.offset as number | undefined) ?? 0;
      const search = args.search as string | undefined;
      const category = args.category as string | undefined;
      const failedOnly = (args.failedOnly as boolean | undefined) ?? false;
      const res = await clients.sabnzbd.getHistory(offset, limit, search, category, failedOnly);
      const h = res.history;
      return ok(
        paginate(
          h.slots.map(s => ({
            nzo_id: s.nzo_id,
            name: s.name,
            cat: s.cat,
            size: s.size,
            status: s.status,
            completed: s.completed ? new Date(s.completed * 1000).toISOString() : undefined,
            ...(s.fail_message ? { failMessage: s.fail_message } : {}),
          })),
          h.noofslots,
          offset,
          limit
        )
      );
    },

    sabnzbd_retry: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const nzo_id = args.nzo_id as string;
      await clients.sabnzbd.retry(nzo_id);
      return ok({ success: true, nzo_id });
    },

    sabnzbd_retry_all: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      await clients.sabnzbd.retryAll();
      return ok({ success: true, message: 'All failed jobs queued for retry' });
    },

    sabnzbd_delete: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const target = args.target as 'queue' | 'history';
      const value = args.value as string;
      const deleteFiles = (args.deleteFiles as boolean | undefined) ?? false;
      if (target === 'queue') {
        await clients.sabnzbd.deleteQueue(value, deleteFiles);
      } else {
        await clients.sabnzbd.deleteHistory(value, deleteFiles);
      }
      return ok({ success: true, target, value, filesDeleted: deleteFiles });
    },

    sabnzbd_get_status: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const s = await clients.sabnzbd.getStatus();
      return ok({
        ...(s.version ? { version: s.version } : {}),
        ...(s.status ? { status: s.status } : {}),
        paused: s.paused ?? false,
        speed: s.speed ?? '0 B/s',
        ...(s.diskspace1 && s.diskspacetotal1 ? {
          diskspaceComplete: `${s.diskspace1} GB free`,
        } : {}),
        ...(s.diskspace2 && s.diskspacetotal2 ? {
          diskspaceDownload: `${s.diskspace2} GB free`,
        } : {}),
        ...(s.completedir ? { completedir: s.completedir } : {}),
        ...(s.downloaddir ? { downloaddir: s.downloaddir } : {}),
        ...(s.logfile ? { logfile: s.logfile } : {}),
        ...(s.loglevel ? { loglevel: s.loglevel } : {}),
        ...(s.loadavg ? { loadavg: s.loadavg } : {}),
      });
    },

    sabnzbd_unblock_server: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const server = args.server as string;
      await clients.sabnzbd.unblockServer(server);
      return ok({ success: true, server, message: 'Server unblocked' });
    },

    // ── High priority — arr integration ────────────────────────────────────

    sabnzbd_add_url: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const { url, name, category, priority, pp } = args as {
        url: string;
        name?: string;
        category?: string;
        priority?: number;
        pp?: number;
      };
      const res = await clients.sabnzbd.addUrl(url, name, category, priority, pp);
      return ok({ success: true, nzo_ids: res.nzo_ids ?? [] });
    },

    sabnzbd_get_cats: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const res = await clients.sabnzbd.getCategories();
      const cats = Array.isArray(res.categories) ? res.categories : [];
      return ok({
        count: cats.length,
        categories: cats.map(c => ({
          name: c.name,
          ...(c.dir ? { dir: c.dir } : {}),
          ...(c.pp !== undefined ? { pp: c.pp } : {}),
          ...(c.script ? { script: c.script } : {}),
          ...(c.priority !== undefined ? { priority: c.priority } : {}),
        })),
      });
    },

    sabnzbd_get_scripts: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const res = await clients.sabnzbd.getScripts();
      const scripts = Array.isArray(res.scripts) ? res.scripts : [];
      return ok({ count: scripts.length, scripts });
    },

    sabnzbd_server_stats: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const res = await clients.sabnzbd.getServerStats();
      const servers = res.servers
        ? Object.entries(res.servers).map(([name, s]) => ({
            name,
            day: formatBytes(s.day),
            week: formatBytes(s.week),
            month: formatBytes(s.month),
            total: formatBytes(s.total),
          }))
        : [];
      return ok({
        total: {
          day: formatBytes((res.day as number | undefined) ?? 0),
          week: formatBytes((res.week as number | undefined) ?? 0),
          month: formatBytes((res.month as number | undefined) ?? 0),
          total: formatBytes((res.total as number | undefined) ?? 0),
        },
        servers,
      });
    },

    // ── Medium priority — job control ──────────────────────────────────────

    sabnzbd_pause: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const nzo_id = args.nzo_id as string | undefined;
      await clients.sabnzbd.pauseQueue(nzo_id);
      return ok({ success: true, scope: nzo_id ? 'job' : 'queue', nzo_id: nzo_id ?? null });
    },

    sabnzbd_resume: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const nzo_id = args.nzo_id as string | undefined;
      await clients.sabnzbd.resumeQueue(nzo_id);
      return ok({ success: true, scope: nzo_id ? 'job' : 'queue', nzo_id: nzo_id ?? null });
    },

    sabnzbd_pause_pp: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      await clients.sabnzbd.pausePostProcessing();
      return ok({ success: true, message: 'Post-processing paused' });
    },

    sabnzbd_resume_pp: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      await clients.sabnzbd.resumePostProcessing();
      return ok({ success: true, message: 'Post-processing resumed' });
    },

    sabnzbd_set_priority: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const nzo_id = args.nzo_id as string;
      const priorityStr = args.priority as string;
      const priorityInt = PRIORITY_MAP[priorityStr];
      if (priorityInt === undefined) throw new Error(`Unknown priority: ${priorityStr}`);
      await clients.sabnzbd.setPriority(nzo_id, priorityInt);
      return ok({ success: true, nzo_id, priority: priorityStr });
    },

    sabnzbd_set_speed_limit: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const value = args.value as string;
      await clients.sabnzbd.setSpeedLimit(value);
      return ok({ success: true, limit: value });
    },

    sabnzbd_change_cat: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const nzo_id = args.nzo_id as string;
      const category = args.category as string;
      await clients.sabnzbd.changeCategory(nzo_id, category);
      return ok({ success: true, nzo_id, category });
    },

    sabnzbd_change_opts: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const nzo_id = args.nzo_id as string;
      const pp = args.pp as number;
      await clients.sabnzbd.changePostProcessing(nzo_id, pp);
      return ok({ success: true, nzo_id, pp });
    },

    sabnzbd_mark_completed: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const nzo_id = args.nzo_id as string;
      await clients.sabnzbd.markCompleted(nzo_id);
      return ok({ success: true, nzo_id, message: 'Job marked as completed' });
    },

    // ── Medium priority — orphan & cleanup recovery ────────────────────────

    sabnzbd_delete_orphans: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      await clients.sabnzbd.deleteOrphans();
      return ok({ success: true, message: 'All orphaned incomplete folders removed' });
    },

    sabnzbd_add_orphans: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      await clients.sabnzbd.addOrphans();
      return ok({ success: true, message: 'All orphaned jobs re-queued' });
    },

    sabnzbd_purge_failed: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      await clients.sabnzbd.purgeFailed();
      return ok({ success: true, message: 'All failed history entries and files purged' });
    },

    // ── Low priority — diagnostics, paths & info ───────────────────────────

    sabnzbd_get_warnings: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const clear = (args.clear as boolean | undefined) ?? false;
      const res = await clients.sabnzbd.getWarnings(clear);
      if (clear) return ok({ success: true, message: 'Warnings cleared' });
      const warnings = (res as { warnings?: unknown[] }).warnings ?? [];
      return ok({ count: warnings.length, warnings });
    },

    sabnzbd_get_paths: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const [miscRes, catRes] = await Promise.all([
        clients.sabnzbd.getPaths(),
        clients.sabnzbd.getCategoryPaths(),
      ]);
      const misc = (miscRes as { config?: { misc?: Record<string, unknown> } }).config?.misc ?? {};
      const dirKeys = Object.entries(misc)
        .filter(([k]) => k.endsWith('_dir'))
        .reduce<Record<string, unknown>>((acc, [k, v]) => { acc[k] = v; return acc; }, {});
      const cats = (catRes as { config?: { categories?: Array<{ name: string; dir?: string }> } }).config?.categories ?? [];
      return ok({
        ...dirKeys,
        categories: cats.map(c => ({ name: c.name, dir: c.dir ?? '' })),
      });
    },

    sabnzbd_get_files: async (args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const nzo_id = args.nzo_id as string;
      const res = await clients.sabnzbd.getFiles(nzo_id);
      const files = res.files ?? [];
      return ok({
        nzo_id,
        count: files.length,
        files: files.map(f => ({
          id: f.id,
          filename: f.filename,
          mbleft: f.mbleft,
          mb: f.mb,
          status: f.status,
        })),
      });
    },

    sabnzbd_version: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      const res = await clients.sabnzbd.getVersion();
      return ok({ version: res.version });
    },

    sabnzbd_rss_now: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      await clients.sabnzbd.rssNow();
      return ok({ success: true, message: 'RSS feeds refreshed' });
    },

    sabnzbd_watched_now: async (_args, clients) => {
      if (!clients.sabnzbd) throw new Error('SABnzbd is not configured');
      await clients.sabnzbd.watchedNow();
      return ok({ success: true, message: 'Watched folder scanned' });
    },
  },
};
