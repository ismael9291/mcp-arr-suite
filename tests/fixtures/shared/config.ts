import type { QualityProfile, HealthCheck, RootFolder, DownloadClient, NamingConfig, MediaManagementConfig, QualityDefinition, Tag, Indexer, SystemStatus } from '../../../src/clients/arr-client.js';

export const systemStatusFixture: SystemStatus = {
  appName: 'Radarr',
  version: '5.3.6.8612',
  buildTime: '2024-02-28T00:00:00Z',
  isDebug: false,
  isProduction: true,
  isAdmin: false,
  isUserInteractive: false,
  startupPath: '/app/radarr',
  appData: '/config',
  osName: 'ubuntu',
  isDocker: true,
  isLinux: true,
  isOsx: false,
  isWindows: false,
};

export const qualityProfileFixtures: QualityProfile[] = [
  {
    id: 4,
    name: 'Ultra-HD',
    upgradeAllowed: true,
    cutoff: 18,
    items: [
      {
        id: 10,
        name: 'Remux-2160p',
        quality: { id: 18, name: 'Remux-2160p', source: 'bluray', resolution: 2160 },
        allowed: true,
      },
      {
        id: 11,
        name: 'HDTV-720p',
        quality: { id: 4, name: 'HDTV-720p', source: 'television', resolution: 720 },
        allowed: false,
      },
    ],
    minFormatScore: 0,
    cutoffFormatScore: 10000,
    formatItems: [
      { format: 1, name: 'HDR10', score: 10 },
      { format: 2, name: 'DV', score: 20 },
    ],
  },
  {
    id: 2,
    name: 'HD-1080p',
    upgradeAllowed: true,
    cutoff: 7,
    items: [
      {
        id: 20,
        quality: { id: 7, name: 'Bluray-1080p', source: 'bluray', resolution: 1080 },
        allowed: true,
      },
    ],
    minFormatScore: 0,
    cutoffFormatScore: 0,
    formatItems: [],
  },
];

export const healthCheckFixtures: HealthCheck[] = [
  {
    source: 'IndexerStatusCheck',
    type: 'warning',
    message: 'Indexers unavailable due to failures: NZBgeek',
    wikiUrl: 'https://wiki.servarr.com/radarr/faq',
  },
];

export const rootFolderFixtures: RootFolder[] = [
  {
    id: 1,
    path: '/movies',
    accessible: true,
    freeSpace: 2_199_023_255_552,
    unmappedFolders: [{ name: 'Unsorted', path: '/movies/Unsorted' }],
  },
  {
    id: 2,
    path: '/movies-4k',
    accessible: true,
    freeSpace: 4_398_046_511_104,
    unmappedFolders: [],
  },
];

export const downloadClientFixtures: DownloadClient[] = [
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
    fields: [{ name: 'host', value: 'sabnzbd' }],
    tags: [],
  },
];

export const namingConfigFixture: NamingConfig = {
  renameMovies: true,
  replaceIllegalCharacters: true,
  colonReplacementFormat: 'delete',
  standardMovieFormat: '{Movie Title} ({Release Year}) {Quality Full}',
  movieFolderFormat: '{Movie Title} ({Release Year})',
};

export const mediaManagementFixture: MediaManagementConfig = {
  recycleBin: '/recycle',
  recycleBinCleanupDays: 7,
  downloadPropersAndRepacks: 'preferAndUpgrade',
  deleteEmptyFolders: true,
  fileDate: 'none',
  rescanAfterRefresh: 'always',
  setPermissionsLinux: false,
  chmodFolder: '755',
  chownGroup: '',
  skipFreeSpaceCheckWhenImporting: false,
  minimumFreeSpaceWhenImporting: 100,
  copyUsingHardlinks: true,
  importExtraFiles: false,
  extraFileExtensions: 'srt,nfo',
  enableMediaInfo: true,
};

export const qualityDefinitionFixtures: QualityDefinition[] = [
  {
    id: 1,
    quality: { id: 7, name: 'Bluray-1080p', source: 'bluray', resolution: 1080 },
    title: 'Bluray-1080p',
    weight: 20,
    minSize: 5,
    maxSize: 225,
    preferredSize: 195,
  },
];

export const tagFixtures: Tag[] = [
  { id: 1, label: 'hdr' },
  { id: 2, label: '4k' },
];

export const indexerFixtures: Indexer[] = [
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
];
