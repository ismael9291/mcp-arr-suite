import type {
  SabnzbdQueueResponse,
  SabnzbdHistoryResponse,
  SabnzbdStatusResponse,
  SabnzbdServerStatsResponse,
} from '../../../src/clients/sabnzbd-client.js';

export const queueFixture: SabnzbdQueueResponse = {
  queue: {
    status: 'Downloading',
    speed: '12.5 MB/s',
    sizeleft: '4.2 GB',
    paused: false,
    noofslots: 2,
    slots: [
      {
        nzo_id: 'SABnzb001',
        filename: 'Show.S01E01.1080p.BluRay.x264',
        cat: 'tv',
        size: '2.1 GB',
        sizeleft: '1.4 GB',
        percentage: '33',
        status: 'Downloading',
        timeleft: '0:03:12',
        priority: 'Normal',
      },
      {
        nzo_id: 'SABnzb002',
        filename: 'Movie.2024.2160p.REMUX',
        cat: 'movies',
        size: '48 GB',
        sizeleft: '45 GB',
        percentage: '6',
        status: 'Downloading',
        timeleft: '1:45:00',
        priority: 'Low',
      },
    ],
  },
};

export const historyFixture: SabnzbdHistoryResponse = {
  history: {
    noofslots: 3,
    slots: [
      {
        nzo_id: 'SABnzb100',
        name: 'Completed.Show.S01E01',
        cat: 'tv',
        size: '2.1 GB',
        status: 'Completed',
        fail_message: '',
        completed: 1715000000,
      },
      {
        nzo_id: 'SABnzb101',
        name: 'Failed.Movie.2024',
        cat: 'movies',
        size: '8.5 GB',
        status: 'Failed',
        fail_message: 'Repair failed',
        completed: 1714900000,
      },
      {
        nzo_id: 'SABnzb102',
        name: 'Another.Show.S02E01',
        cat: 'tv',
        size: '1.5 GB',
        status: 'Completed',
        fail_message: '',
        completed: 1714800000,
      },
    ],
  },
};

export const statusFixture: SabnzbdStatusResponse = {
  version: '4.3.1',
  status: 'Idle',
  paused: false,
  speed: '0 B/s',
  diskspace1: '1200',
  diskspacetotal1: '2000',
  diskspace2: '800',
  diskspacetotal2: '1000',
  completedir: '/downloads/complete',
  downloaddir: '/downloads/incomplete',
  logfile: '/config/logs/sabnzbd.log',
  loglevel: '1',
  loadavg: '0.42',
};

export const serverStatsFixture: SabnzbdServerStatsResponse = {
  day: 12582912,
  week: 92274688,
  month: 334544896,
  total: 4398046511104,
  servers: {
    'news.example.com': {
      day: 10485760,
      week: 83886080,
      month: 314572800,
      total: 4294967296000,
    },
  },
};

export const categoriesFixture = {
  categories: [
    { name: 'tv', dir: '/downloads/tv', pp: '3', script: 'None', priority: 0 },
    { name: 'movies', dir: '/downloads/movies', pp: '3', script: 'None', priority: 0 },
    { name: '*', dir: '', pp: '3', script: 'None', priority: 0 },
  ],
};

export const scriptsFixture = {
  scripts: ['cleanup.py', 'notify.sh'],
};

export const warningsFixture = {
  warnings: [
    { type: 'WARNING', time: '2026-04-14T10:00:00', text: 'Server timeout on news.example.com' },
    { type: 'ERROR', time: '2026-04-14T09:30:00', text: 'Failed to unpack archive' },
  ],
};

export const filesFixture = {
  files: [
    { id: 'SABnzf001', filename: 'show.s01e01.part01.rar', mbleft: 450.2, mb: 800.0, status: 'active' },
    { id: 'SABnzf002', filename: 'show.s01e01.part02.rar', mbleft: 800.0, mb: 800.0, status: 'queued' },
  ],
};
