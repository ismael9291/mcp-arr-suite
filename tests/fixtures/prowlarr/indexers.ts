import type { Indexer, IndexerStats, ProwlarrHistoryRecord, ProwlarrApplication, Tag, DownloadClient } from '../../../src/clients/arr-client.js';

export const prowlarrIndexerFixtures: Indexer[] = [
  {
    id: 1,
    name: 'NZBgeek',
    enableRss: true,
    enableAutomaticSearch: true,
    enableInteractiveSearch: true,
    protocol: 'usenet',
    priority: 25,
    added: '2023-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'DrunkenSlug',
    enableRss: true,
    enableAutomaticSearch: true,
    enableInteractiveSearch: false,
    protocol: 'usenet',
    priority: 50,
    added: '2023-03-15T00:00:00Z',
  },
  {
    id: 3,
    name: '1337x',
    enableRss: false,
    enableAutomaticSearch: true,
    enableInteractiveSearch: true,
    protocol: 'torrent',
    priority: 75,
    added: '2023-06-01T00:00:00Z',
  },
];

export const indexerStatsFixtures: IndexerStats[] = [
  {
    id: 1,
    indexerId: 1,
    indexerName: 'NZBgeek',
    averageResponseTime: 450,
    numberOfQueries: 1240,
    numberOfGrabs: 87,
    numberOfRssQueries: 720,
    numberOfAuthQueries: 2,
    numberOfFailedQueries: 14,
    numberOfFailedGrabs: 1,
    numberOfFailedRssQueries: 3,
    numberOfFailedAuthQueries: 0,
  },
  {
    id: 2,
    indexerId: 2,
    indexerName: 'DrunkenSlug',
    averageResponseTime: 820,
    numberOfQueries: 340,
    numberOfGrabs: 12,
    numberOfRssQueries: 180,
    numberOfAuthQueries: 1,
    numberOfFailedQueries: 45,
    numberOfFailedGrabs: 4,
    numberOfFailedRssQueries: 22,
    numberOfFailedAuthQueries: 0,
  },
];

export const prowlarrSearchResultFixtures = [
  {
    guid: 'nzbgeek-12345',
    indexerId: 1,
    indexer: 'NZBgeek',
    title: 'Dune.Part.Two.2024.2160p.BluRay.REMUX.HEVC.TrueHD.Atmos-GROUP',
    sortTitle: 'dune part two 2024',
    protocol: 'usenet',
    size: 48_318_382_080,
    publishDate: '2024-05-15T12:00:00Z',
    seeders: undefined,
    leechers: undefined,
    categories: [{ id: 2000, name: 'Movies' }],
  },
  {
    guid: '1337x-67890',
    indexerId: 3,
    indexer: '1337x',
    title: 'Dune.Part.Two.2024.1080p.BluRay.x264-GROUP',
    sortTitle: 'dune part two 2024',
    protocol: 'torrent',
    size: 12_884_901_888,
    publishDate: '2024-05-12T08:00:00Z',
    seeders: 412,
    leechers: 23,
    categories: [{ id: 2000, name: 'Movies' }],
  },
];

export const prowlarrHistoryFixtures: { records: ProwlarrHistoryRecord[]; totalRecords: number } = {
  totalRecords: 2,
  records: [
    {
      id: 101,
      indexerId: 1,
      indexer: 'NZBgeek',
      date: '2024-05-15T14:00:00Z',
      successful: true,
      eventType: 'grabbed',
      sourceTitle: 'Dune.Part.Two.2024.2160p.BluRay.REMUX-GROUP',
      downloadId: 'abc123',
      data: {},
    },
    {
      id: 102,
      indexerId: 3,
      indexer: '1337x',
      date: '2024-05-14T10:00:00Z',
      successful: false,
      eventType: 'grabFailed',
      sourceTitle: 'Some.Show.S01E01-GROUP',
      downloadId: undefined,
      data: { reason: 'Indexer error' },
    },
  ],
};

export const prowlarrTagFixtures: Tag[] = [
  { id: 1, label: 'vip' },
  { id: 2, label: 'movies-only' },
];

export const prowlarrDownloadClientFixtures: DownloadClient[] = [
  {
    id: 1,
    name: 'SABnzbd',
    implementation: 'Sabnzbd',
    implementationName: 'SABnzbd',
    configContract: 'SabnzbdSettings',
    enable: true,
    protocol: 'usenet',
    priority: 1,
    removeCompletedDownloads: true,
    removeFailedDownloads: true,
    fields: [{ name: 'host', value: 'localhost' }],
    tags: [],
  },
];

export const prowlarrApplicationFixtures: ProwlarrApplication[] = [
  {
    id: 1,
    name: 'Radarr',
    implementation: 'Radarr',
    implementationName: 'Radarr',
    syncLevel: 'fullSync',
    enable: true,
    tags: [],
    fields: [{ name: 'prowlarrUrl', value: 'http://localhost:9696' }],
  },
  {
    id: 2,
    name: 'Sonarr',
    implementation: 'Sonarr',
    implementationName: 'Sonarr',
    syncLevel: 'fullSync',
    enable: true,
    tags: [1],
    fields: [{ name: 'prowlarrUrl', value: 'http://localhost:9696' }],
  },
];
