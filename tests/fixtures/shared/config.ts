import type { QualityProfile, HealthCheck, RootFolder, DownloadClient, NamingConfig, MediaManagementConfig, QualityDefinition, Tag, Indexer, SystemStatus, CustomFormat, SystemTask, LogPage, Notification, ImportList } from '../../../src/clients/arr-client.js';

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

export const customFormatFixtures: CustomFormat[] = [
  {
    id: 1,
    name: 'HDR10',
    includeCustomFormatWhenRenaming: false,
    specifications: [
      {
        id: 10,
        name: 'HDR10',
        implementation: 'ReleaseTitleSpecification',
        implementationName: 'Release Title',
        negate: false,
        required: false,
        fields: [{ name: 'value', value: '\\bHDR10\\b' }],
      },
    ],
  },
  {
    id: 2,
    name: 'x265 (HD)',
    includeCustomFormatWhenRenaming: false,
    specifications: [
      {
        id: 11,
        name: 'x265/HEVC',
        implementation: 'ReleaseTitleSpecification',
        implementationName: 'Release Title',
        negate: false,
        required: false,
        fields: [{ name: 'value', value: '\\bx265\\b|\\bHEVC\\b' }],
      },
    ],
  },
];

export const systemTaskFixtures: SystemTask[] = [
  {
    id: 1,
    name: 'Housekeeping',
    taskName: 'Housekeeping',
    interval: 360,
    lastExecution: '2024-03-01T00:00:00Z',
    lastStartTime: '2024-03-01T00:00:00Z',
    nextExecution: '2024-03-01T06:00:00Z',
    lastDuration: '00:00:01.2340000',
    isRunning: false,
  },
  {
    id: 2,
    name: 'RSS Sync',
    taskName: 'RssSync',
    interval: 60,
    lastExecution: '2024-03-01T01:00:00Z',
    lastStartTime: '2024-03-01T01:00:00Z',
    nextExecution: '2024-03-01T02:00:00Z',
    lastDuration: '00:00:05.0000000',
    isRunning: true,
  },
];

export const logPageFixture: LogPage = {
  page: 1,
  pageSize: 20,
  sortKey: 'time',
  sortDirection: 'descending',
  totalRecords: 2,
  records: [
    {
      id: 101,
      time: '2024-03-01T02:00:00Z',
      level: 'info',
      logger: 'NzbDrone.Core.Download.TrackedDownloads.TrackedDownloadService',
      message: 'Processing download',
    },
    {
      id: 100,
      time: '2024-03-01T01:59:00Z',
      level: 'warn',
      logger: 'NzbDrone.Core.Parser',
      message: 'Unable to parse quality',
      exception: 'ParseException: ...',
      exceptionType: 'ParseException',
    },
  ],
};

export const notificationFixtures: Notification[] = [
  {
    id: 1,
    name: 'Slack',
    implementation: 'Slack',
    implementationName: 'Slack',
    onGrab: true,
    onDownload: true,
    onUpgrade: true,
    onRename: false,
    onHealthIssue: true,
    onApplicationUpdate: false,
    supportsOnGrab: true,
    supportsOnDownload: true,
    supportsOnUpgrade: true,
    supportsOnRename: true,
    supportsOnHealthIssue: true,
    supportsOnApplicationUpdate: true,
    tags: [],
    fields: [{ name: 'webHookUrl', value: 'https://hooks.slack.com/services/xxx' }],
  },
  {
    id: 2,
    name: 'Webhook',
    implementation: 'Webhook',
    implementationName: 'Webhook',
    onGrab: false,
    onDownload: true,
    onUpgrade: false,
    onRename: false,
    onHealthIssue: false,
    onApplicationUpdate: false,
    supportsOnGrab: true,
    supportsOnDownload: true,
    supportsOnUpgrade: true,
    supportsOnRename: true,
    supportsOnHealthIssue: true,
    supportsOnApplicationUpdate: true,
    tags: [1],
    fields: [{ name: 'url', value: 'https://example.com/webhook' }],
  },
];

export const importListFixtures: ImportList[] = [
  {
    id: 1,
    name: 'Trakt Popular',
    implementation: 'TraktPopularList',
    implementationName: 'Trakt Popular',
    enabled: true,
    enableAuto: false,
    shouldMonitor: true,
    qualityProfileId: 1,
    tags: [],
    fields: [{ name: 'accessToken', value: 'xxx' }],
  },
  {
    id: 2,
    name: 'IMDb Watchlist',
    implementation: 'IMDbList',
    implementationName: 'IMDb List',
    enabled: false,
    enableAuto: true,
    shouldMonitor: true,
    qualityProfileId: 1,
    tags: [1],
    fields: [{ name: 'listId', value: 'ls012345678' }],
  },
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
