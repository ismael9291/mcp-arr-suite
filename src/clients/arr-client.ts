/**
 * *arr Suite API Client
 *
 * All *arr applications share the same REST API pattern with X-Api-Key authentication.
 * Extend ArrClient to add a new service.
 */

export type ArrService = 'sonarr' | 'radarr' | 'lidarr' | 'prowlarr';

export interface ArrConfig {
  url: string;
  apiKey: string;
}

// ─── Shared interfaces ────────────────────────────────────────────────────────

export interface SystemStatus {
  appName: string;
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  isDocker: boolean;
  isLinux: boolean;
  isOsx: boolean;
  isWindows: boolean;
}

export interface QueueItem {
  id: number;
  title: string;
  status: string;
  trackedDownloadStatus: string;
  trackedDownloadState: string;
  statusMessages: Array<{ title: string; messages: string[] }>;
  downloadId: string;
  protocol: string;
  downloadClient: string;
  outputPath: string;
  sizeleft: number;
  size: number;
  timeleft: string;
  estimatedCompletionTime: string;
}

export interface QualityProfile {
  id: number;
  name: string;
  upgradeAllowed: boolean;
  cutoff: number;
  items: Array<{
    id?: number;
    name?: string;
    quality?: { id: number; name: string; source: string; resolution: number };
    items?: Array<{ quality: { id: number; name: string } }>;
    allowed: boolean;
  }>;
  minFormatScore: number;
  cutoffFormatScore: number;
  formatItems: Array<{ format: number; name: string; score: number }>;
}

export interface QualityDefinition {
  id: number;
  quality: { id: number; name: string; source: string; resolution: number };
  title: string;
  weight: number;
  minSize: number;
  maxSize: number;
  preferredSize: number;
}

export interface DownloadClient {
  id: number;
  name: string;
  implementation: string;
  implementationName: string;
  configContract: string;
  enable: boolean;
  protocol: string;
  priority: number;
  removeCompletedDownloads: boolean;
  removeFailedDownloads: boolean;
  fields: Array<{ name: string; value: unknown }>;
  tags: number[];
}

export interface NamingConfig {
  renameEpisodes?: boolean;
  replaceIllegalCharacters: boolean;
  colonReplacementFormat?: string;
  standardEpisodeFormat?: string;
  dailyEpisodeFormat?: string;
  animeEpisodeFormat?: string;
  seriesFolderFormat?: string;
  seasonFolderFormat?: string;
  specialsFolderFormat?: string;
  multiEpisodeStyle?: number;
  renameMovies?: boolean;
  movieFolderFormat?: string;
  standardMovieFormat?: string;
  renameTracks?: boolean;
  artistFolderFormat?: string;
  albumFolderFormat?: string;
  trackFormat?: string;
}

export interface MediaManagementConfig {
  recycleBin: string;
  recycleBinCleanupDays: number;
  downloadPropersAndRepacks: string;
  deleteEmptyFolders: boolean;
  fileDate: string;
  rescanAfterRefresh: string;
  setPermissionsLinux: boolean;
  chmodFolder: string;
  chownGroup: string;
  skipFreeSpaceCheckWhenImporting: boolean;
  minimumFreeSpaceWhenImporting: number;
  copyUsingHardlinks: boolean;
  importExtraFiles: boolean;
  extraFileExtensions: string;
  enableMediaInfo: boolean;
}

export interface HealthCheck {
  source: string;
  type: string;
  message: string;
  wikiUrl: string;
}

export interface Tag {
  id: number;
  label: string;
}

export interface RootFolder {
  id: number;
  path: string;
  accessible: boolean;
  freeSpace: number;
  unmappedFolders?: Array<{ name: string; path: string }>;
}

export interface Indexer {
  id: number;
  name: string;
  enableRss: boolean;
  enableAutomaticSearch: boolean;
  enableInteractiveSearch: boolean;
  protocol: string;
  priority: number;
  added: string;
}

export interface SearchResult {
  title: string;
  sortTitle: string;
  status: string;
  overview: string;
  year: number;
  images: Array<{ coverType: string; url: string }>;
  remotePoster?: string;
  tvdbId?: number;
  tmdbId?: number;
  imdbId?: string;
  foreignArtistId?: string;
  artistName?: string;
  disambiguation?: string;
}

// ─── Media interfaces ─────────────────────────────────────────────────────────

export interface Series {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  overview: string;
  network: string;
  airTime: string;
  year: number;
  path: string;
  qualityProfileId: number;
  seasonFolder: boolean;
  monitored: boolean;
  runtime: number;
  tvdbId: number;
  imdbId: string;
  titleSlug: string;
  genres: string[];
  tags: number[];
  seasons: Array<{ seasonNumber: number; monitored: boolean }>;
  statistics: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
}

export interface Episode {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  airDateUtc: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
  absoluteEpisodeNumber: number;
  episodeFile?: {
    id: number;
    relativePath: string;
    path: string;
    size: number;
    dateAdded: string;
    quality: { quality: { id: number; name: string } };
  };
}

export interface Movie {
  id: number;
  title: string;
  sortTitle: string;
  sizeOnDisk: number;
  status: string;
  overview: string;
  inCinemas: string;
  physicalRelease: string;
  digitalRelease: string;
  year: number;
  hasFile: boolean;
  studio: string;
  path: string;
  qualityProfileId: number;
  monitored: boolean;
  minimumAvailability: string;
  isAvailable: boolean;
  runtime: number;
  imdbId: string;
  tmdbId: number;
  titleSlug: string;
  genres: string[];
  tags: number[];
  movieFile?: {
    id: number;
    relativePath: string;
    path: string;
    size: number;
    dateAdded: string;
    quality: { quality: { id: number; name: string } };
  };
}

export interface Artist {
  id: number;
  artistName: string;
  sortName: string;
  status: string;
  overview: string;
  artistType: string;
  disambiguation: string;
  path: string;
  qualityProfileId: number;
  metadataProfileId: number;
  monitored: boolean;
  monitorNewItems: string;
  genres: string[];
  foreignArtistId: string;
  tags: number[];
  statistics: {
    albumCount: number;
    trackFileCount: number;
    trackCount: number;
    totalTrackCount: number;
    sizeOnDisk: number;
    percentOfTracks: number;
  };
}

export interface Album {
  id: number;
  title: string;
  disambiguation: string;
  overview: string;
  artistId: number;
  foreignAlbumId: string;
  monitored: boolean;
  profileId: number;
  duration: number;
  albumType: string;
  genres: string[];
  statistics?: {
    trackFileCount: number;
    trackCount: number;
    totalTrackCount: number;
    sizeOnDisk: number;
    percentOfTracks: number;
  };
  releaseDate: string;
  grabbed: boolean;
}

export interface MetadataProfile {
  id: number;
  name: string;
  minPopularity?: number;
  skipMissingDate: boolean;
  skipMissingIsbn: boolean;
  skipPartsAndSets: boolean;
  skipSeriesSecondary: boolean;
  allowedLanguages?: string;
  minPages?: number;
}

export interface DiskSpace {
  path: string;
  label: string;
  freeSpace: number;
  totalSpace: number;
}

export interface MovieFile {
  id: number;
  movieId: number;
  relativePath: string;
  path: string;
  size: number;
  dateAdded: string;
  quality: { quality: { id: number; name: string; source: string; resolution: number }; revision: { version: number; real: number } };
  mediaInfo?: {
    audioChannels: number;
    audioCodec: string;
    audioLanguages: string;
    subtitles: string;
    videoCodec: string;
    videoDynamicRange: string;
    videoDynamicRangeType: string;
  };
  originalFilePath?: string;
  qualityCutoffNotMet: boolean;
  languages: Array<{ id: number; name: string }>;
  edition: string;
}

export interface HistoryRecord {
  id: number;
  movieId: number;
  sourceTitle: string;
  languages: Array<{ id: number; name: string }>;
  quality: { quality: { id: number; name: string } };
  customFormats?: Array<{ id: number; name: string }>;
  qualityCutoffNotMet: boolean;
  date: string;
  downloadId?: string;
  eventType: string;
  data: Record<string, string>;
}

export interface BlocklistRecord {
  id: number;
  movieId: number;
  sourceTitle: string;
  languages: Array<{ id: number; name: string }>;
  quality: { quality: { id: number; name: string } };
  date: string;
  protocol: string;
  indexer: string;
  message: string;
}

export interface WantedRecord {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: Movie[];
}

export interface EpisodeFile {
  id: number;
  seriesId: number;
  seasonNumber: number;
  relativePath: string;
  path: string;
  size: number;
  dateAdded: string;
  quality: { quality: { id: number; name: string }; revision: { version: number; real: number } };
  mediaInfo?: {
    audioChannels: number;
    audioCodec: string;
    audioLanguages: string;
    subtitles: string;
    videoCodec: string;
    videoDynamicRange: string;
    videoDynamicRangeType: string;
  };
  qualityCutoffNotMet: boolean;
  languages: Array<{ id: number; name: string }>;
}

export interface SeriesHistoryRecord {
  id: number;
  episodeId: number;
  seriesId: number;
  sourceTitle: string;
  languages: Array<{ id: number; name: string }>;
  quality: { quality: { id: number; name: string } };
  qualityCutoffNotMet: boolean;
  date: string;
  downloadId?: string;
  eventType: string;
  data: Record<string, string>;
}

export interface SeriesWantedRecord {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: Series[];
}

export interface SeriesBlocklistRecord {
  id: number;
  seriesId: number;
  episodeIds: number[];
  sourceTitle: string;
  languages: Array<{ id: number; name: string }>;
  quality: { quality: { id: number; name: string } };
  date: string;
  protocol: string;
  indexer: string;
  message: string;
}

export interface IndexerStats {
  id: number;
  indexerId: number;
  indexerName: string;
  averageResponseTime: number;
  numberOfQueries: number;
  numberOfGrabs: number;
  numberOfRssQueries: number;
  numberOfAuthQueries: number;
  numberOfFailedQueries: number;
  numberOfFailedGrabs: number;
  numberOfFailedRssQueries: number;
  numberOfFailedAuthQueries: number;
}

export interface ProwlarrHistoryRecord {
  id: number;
  indexerId: number;
  indexer: string;
  date: string;
  successful: boolean;
  eventType: string;
  sourceTitle?: string;
  downloadId?: string;
  data: Record<string, unknown>;
}

export interface ImportExclusion {
  id: number;
  title: string;
  year?: number;
  tvdbId?: number;
  tmdbId?: number;
}

export interface CustomFormat {
  id: number;
  name: string;
  includeCustomFormatWhenRenaming: boolean;
  specifications: Array<{
    id?: number;
    name: string;
    implementation: string;
    implementationName?: string;
    negate: boolean;
    required: boolean;
    fields: Array<{ name: string; value: unknown }>;
  }>;
}

export interface ProwlarrApplication {
  id: number;
  name: string;
  implementation: string;
  implementationName: string;
  syncLevel: string;
  enable: boolean;
  tags: number[];
  fields: Array<{ name: string; value: unknown }>;
}

// ─── Base client ──────────────────────────────────────────────────────────────

export class ArrClient {
  private readonly config: ArrConfig;
  private readonly serviceName: ArrService;
  protected apiVersion: string = 'v3';

  constructor(serviceName: ArrService, config: ArrConfig) {
    this.serviceName = serviceName;
    this.config = {
      url: config.url.replace(/\/$/, ''),
      apiKey: config.apiKey,
    };
  }

  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.url}/api/${this.apiVersion}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': this.config.apiKey,
      ...(options.headers as Record<string, string> ?? {}),
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${this.serviceName} API error: ${response.status} ${response.statusText} - ${text}`);
    }
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as unknown as T;
    }
    return response.json() as Promise<T>;
  }

  async getStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('/system/status');
  }

  async getQueue(): Promise<{ records: QueueItem[]; totalRecords: number }> {
    return this.request<{ records: QueueItem[]; totalRecords: number }>(
      '/queue?includeUnknownSeriesItems=true&includeUnknownMovieItems=true'
    );
  }

  async getCalendar(start?: string, end?: string): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<unknown[]>(`/calendar${query}`);
  }

  async getQualityProfiles(): Promise<QualityProfile[]> {
    return this.request<QualityProfile[]>('/qualityprofile');
  }

  async getQualityDefinitions(): Promise<QualityDefinition[]> {
    return this.request<QualityDefinition[]>('/qualitydefinition');
  }

  async getDownloadClients(): Promise<DownloadClient[]> {
    return this.request<DownloadClient[]>('/downloadclient');
  }

  async getNamingConfig(): Promise<NamingConfig> {
    return this.request<NamingConfig>('/config/naming');
  }

  async getMediaManagement(): Promise<MediaManagementConfig> {
    return this.request<MediaManagementConfig>('/config/mediamanagement');
  }

  async getHealth(): Promise<HealthCheck[]> {
    return this.request<HealthCheck[]>('/health');
  }

  async getTags(): Promise<Tag[]> {
    return this.request<Tag[]>('/tag');
  }

  async getRootFolders(): Promise<RootFolder[]> {
    return this.request<RootFolder[]>('/rootfolder');
  }

  async getIndexers(): Promise<Indexer[]> {
    return this.request<Indexer[]>('/indexer');
  }

  async getQualityProfile(id: number): Promise<QualityProfile> {
    return this.request<QualityProfile>(`/qualityprofile/${id}`);
  }

  async updateQualityProfile(id: number, profile: QualityProfile): Promise<QualityProfile> {
    return this.request<QualityProfile>(`/qualityprofile/${id}`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  async getCustomFormats(): Promise<CustomFormat[]> {
    return this.request<CustomFormat[]>('/customformat');
  }

  async createTag(label: string): Promise<Tag> {
    return this.request<Tag>('/tag', {
      method: 'POST',
      body: JSON.stringify({ label }),
    });
  }

  async deleteTag(id: number): Promise<void> {
    await this.request<void>(`/tag/${id}`, { method: 'DELETE' });
  }

  async runCommand(name: string, extra?: Record<string, unknown>): Promise<{ id: number }> {
    return this.request<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name, ...extra }),
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getStatus();
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Service clients ──────────────────────────────────────────────────────────

export class SonarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('sonarr', config);
  }

  async getSeries(): Promise<Series[]> {
    return this.request<Series[]>('/series');
  }

  async getSeriesById(id: number): Promise<Series> {
    return this.request<Series>(`/series/${id}`);
  }

  async searchSeries(term: string): Promise<SearchResult[]> {
    return this.request<SearchResult[]>(`/series/lookup?term=${encodeURIComponent(term)}`);
  }

  async addSeries(series: Partial<Series> & {
    tvdbId: number;
    rootFolderPath: string;
    qualityProfileId: number;
  }): Promise<Series> {
    return this.request<Series>('/series', {
      method: 'POST',
      body: JSON.stringify({
        ...series,
        monitored: series.monitored ?? true,
        seasonFolder: series.seasonFolder ?? true,
        addOptions: { searchForMissingEpisodes: true },
      }),
    });
  }

  async getEpisodes(seriesId: number, seasonNumber?: number): Promise<Episode[]> {
    let url = `/episode?seriesId=${seriesId}`;
    if (seasonNumber !== undefined) url += `&seasonNumber=${seasonNumber}`;
    return this.request<Episode[]>(url);
  }

  async searchMissing(seriesId: number): Promise<{ id: number }> {
    return this.request<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name: 'SeriesSearch', seriesId }),
    });
  }

  async searchEpisode(episodeIds: number[]): Promise<{ id: number }> {
    return this.request<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name: 'EpisodeSearch', episodeIds }),
    });
  }

  async refreshSeries(seriesId: number): Promise<{ id: number }> {
    return this.request<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name: 'RefreshSeries', seriesId }),
    });
  }

  async deleteSeries(seriesId: number, deleteFiles = false, addImportListExclusion = false): Promise<void> {
    await this.request<void>(
      `/series/${seriesId}?deleteFiles=${deleteFiles}&addImportListExclusion=${addImportListExclusion}`,
      { method: 'DELETE' }
    );
  }

  async updateSeries(seriesId: number, changes: Partial<Series>): Promise<Series> {
    const existing = await this.getSeriesById(seriesId);
    return this.request<Series>(`/series/${seriesId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...existing, ...changes }),
    });
  }

  async getDiskSpace(): Promise<DiskSpace[]> {
    return this.request<DiskSpace[]>('/diskspace');
  }

  async getHistory(seriesId?: number, page = 1, pageSize = 20): Promise<{ records: SeriesHistoryRecord[]; totalRecords: number }> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortKey: 'date',
      sortDirection: 'descending',
    });
    const endpoint = seriesId !== undefined
      ? `/history/series?seriesId=${seriesId}&${params}`
      : `/history?${params}`;
    return this.request<{ records: SeriesHistoryRecord[]; totalRecords: number }>(endpoint);
  }

  async removeFromQueue(queueId: number, blocklist = false, removeFromClient = true): Promise<void> {
    await this.request<void>(
      `/queue/${queueId}?blocklist=${blocklist}&removeFromClient=${removeFromClient}`,
      { method: 'DELETE' }
    );
  }

  async removeFromQueueBulk(ids: number[], blocklist = false, removeFromClient = true): Promise<void> {
    await this.request<void>('/queue/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids, blocklist, removeFromClient }),
    });
  }

  async getWantedMissing(page = 1, pageSize = 20): Promise<SeriesWantedRecord> {
    return this.request<SeriesWantedRecord>(
      `/wanted/missing?page=${page}&pageSize=${pageSize}&sortKey=series.sortTitle&sortDirection=ascending`
    );
  }

  async getWantedCutoff(page = 1, pageSize = 20): Promise<SeriesWantedRecord> {
    return this.request<SeriesWantedRecord>(
      `/wanted/cutoff?page=${page}&pageSize=${pageSize}&sortKey=series.sortTitle&sortDirection=ascending`
    );
  }

  async getEpisodeFiles(seriesId: number): Promise<EpisodeFile[]> {
    return this.request<EpisodeFile[]>(`/episodefile?seriesId=${seriesId}`);
  }

  async deleteEpisodeFile(fileId: number): Promise<void> {
    await this.request<void>(`/episodefile/${fileId}`, { method: 'DELETE' });
  }

  async getBlocklist(page = 1, pageSize = 20): Promise<{ records: SeriesBlocklistRecord[]; totalRecords: number }> {
    return this.request<{ records: SeriesBlocklistRecord[]; totalRecords: number }>(
      `/blocklist?page=${page}&pageSize=${pageSize}&sortKey=date&sortDirection=descending`
    );
  }

  async deleteFromBlocklist(blocklistId: number): Promise<void> {
    await this.request<void>(`/blocklist/${blocklistId}`, { method: 'DELETE' });
  }

  async monitorEpisodes(episodeIds: number[], monitored: boolean): Promise<void> {
    await this.request<void>('/episode/monitor', {
      method: 'PUT',
      body: JSON.stringify({ episodeIds, monitored }),
    });
  }

  async setSeasonPass(series: Array<{ id: number; monitored: boolean; seasons: Array<{ seasonNumber: number; monitored: boolean }> }>): Promise<void> {
    await this.request<void>('/seasonpass', {
      method: 'POST',
      body: JSON.stringify({ series, monitoringOptions: { monitor: 'all' } }),
    });
  }

  async getImportExclusions(): Promise<ImportExclusion[]> {
    return this.request<ImportExclusion[]>('/importlistexclusion');
  }

  async deleteImportExclusion(id: number): Promise<void> {
    await this.request<void>(`/importlistexclusion/${id}`, { method: 'DELETE' });
  }
}

export class RadarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('radarr', config);
  }

  async getMovies(): Promise<Movie[]> {
    return this.request<Movie[]>('/movie');
  }

  async getMovieById(id: number): Promise<Movie> {
    return this.request<Movie>(`/movie/${id}`);
  }

  async searchMovies(term: string): Promise<SearchResult[]> {
    return this.request<SearchResult[]>(`/movie/lookup?term=${encodeURIComponent(term)}`);
  }

  async addMovie(movie: Partial<Movie> & {
    tmdbId: number;
    rootFolderPath: string;
    qualityProfileId: number;
  }): Promise<Movie> {
    return this.request<Movie>('/movie', {
      method: 'POST',
      body: JSON.stringify({
        ...movie,
        monitored: movie.monitored ?? true,
        addOptions: { searchForMovie: true },
      }),
    });
  }

  async searchMovie(movieId: number): Promise<{ id: number }> {
    return this.request<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name: 'MoviesSearch', movieIds: [movieId] }),
    });
  }

  async refreshMovie(movieId: number): Promise<{ id: number }> {
    return this.request<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name: 'RefreshMovie', movieIds: [movieId] }),
    });
  }

  async deleteMovie(movieId: number, deleteFiles = false, addImportExclusion = false): Promise<void> {
    await this.request<void>(
      `/movie/${movieId}?deleteFiles=${deleteFiles}&addImportExclusion=${addImportExclusion}`,
      { method: 'DELETE' }
    );
  }

  async updateMovie(movieId: number, changes: Partial<Movie>): Promise<Movie> {
    const existing = await this.getMovieById(movieId);
    return this.request<Movie>(`/movie/${movieId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...existing, ...changes }),
    });
  }

  async getDiskSpace(): Promise<DiskSpace[]> {
    return this.request<DiskSpace[]>('/diskspace');
  }

  async getHistory(movieId?: number, page = 1, pageSize = 20): Promise<{ records: HistoryRecord[]; totalRecords: number }> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortKey: 'date',
      sortDirection: 'descending',
    });
    const endpoint = movieId !== undefined
      ? `/history/movie?movieId=${movieId}&${params}`
      : `/history?${params}`;
    return this.request<{ records: HistoryRecord[]; totalRecords: number }>(endpoint);
  }

  async removeFromQueue(queueId: number, blocklist = false, removeFromClient = true): Promise<void> {
    await this.request<void>(
      `/queue/${queueId}?blocklist=${blocklist}&removeFromClient=${removeFromClient}`,
      { method: 'DELETE' }
    );
  }

  async removeFromQueueBulk(ids: number[], blocklist = false, removeFromClient = true): Promise<void> {
    await this.request<void>('/queue/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids, blocklist, removeFromClient }),
    });
  }

  async getWantedMissing(page = 1, pageSize = 20): Promise<WantedRecord> {
    return this.request<WantedRecord>(
      `/wanted/missing?page=${page}&pageSize=${pageSize}&sortKey=title&sortDirection=ascending`
    );
  }

  async getWantedCutoff(page = 1, pageSize = 20): Promise<WantedRecord> {
    return this.request<WantedRecord>(
      `/wanted/cutoff?page=${page}&pageSize=${pageSize}&sortKey=title&sortDirection=ascending`
    );
  }

  async getMovieFiles(movieId: number): Promise<MovieFile[]> {
    return this.request<MovieFile[]>(`/moviefile?movieId=${movieId}`);
  }

  async deleteMovieFile(fileId: number): Promise<void> {
    await this.request<void>(`/moviefile/${fileId}`, { method: 'DELETE' });
  }

  async getBlocklist(page = 1, pageSize = 20): Promise<{ records: BlocklistRecord[]; totalRecords: number }> {
    return this.request<{ records: BlocklistRecord[]; totalRecords: number }>(
      `/blocklist/movie?page=${page}&pageSize=${pageSize}`
    );
  }

  async deleteFromBlocklist(blocklistId: number): Promise<void> {
    await this.request<void>(`/blocklist/${blocklistId}`, { method: 'DELETE' });
  }

  async getImportExclusions(): Promise<ImportExclusion[]> {
    return this.request<ImportExclusion[]>('/importexclusion');
  }

  async deleteImportExclusion(id: number): Promise<void> {
    await this.request<void>(`/importexclusion/${id}`, { method: 'DELETE' });
  }
}

export class LidarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('lidarr', config);
    this.apiVersion = 'v1';
  }

  async getArtists(): Promise<Artist[]> {
    return this.request<Artist[]>('/artist');
  }

  async getArtistById(id: number): Promise<Artist> {
    return this.request<Artist>(`/artist/${id}`);
  }

  async searchArtists(term: string): Promise<SearchResult[]> {
    return this.request<SearchResult[]>(`/artist/lookup?term=${encodeURIComponent(term)}`);
  }

  async addArtist(artist: Partial<Artist> & {
    foreignArtistId: string;
    rootFolderPath: string;
    qualityProfileId: number;
    metadataProfileId: number;
  }): Promise<Artist> {
    return this.request<Artist>('/artist', {
      method: 'POST',
      body: JSON.stringify({
        ...artist,
        monitored: artist.monitored ?? true,
        addOptions: { searchForMissingAlbums: true },
      }),
    });
  }

  async getAlbums(artistId?: number): Promise<Album[]> {
    const url = artistId !== undefined ? `/album?artistId=${artistId}` : '/album';
    return this.request<Album[]>(url);
  }

  async getAlbumById(id: number): Promise<Album> {
    return this.request<Album>(`/album/${id}`);
  }

  async searchAlbum(albumId: number): Promise<{ id: number }> {
    return this.request<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name: 'AlbumSearch', albumIds: [albumId] }),
    });
  }

  async searchMissingAlbums(artistId: number): Promise<{ id: number }> {
    return this.request<{ id: number }>('/command', {
      method: 'POST',
      body: JSON.stringify({ name: 'ArtistSearch', artistId }),
    });
  }

  async getCalendar(start?: string, end?: string): Promise<Album[]> {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Album[]>(`/calendar${query}`);
  }

  async getMetadataProfiles(): Promise<MetadataProfile[]> {
    return this.request<MetadataProfile[]>('/metadataprofile');
  }
}

export class ProwlarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super('prowlarr', config);
    this.apiVersion = 'v1';
  }

  async getIndexers(): Promise<Indexer[]> {
    return this.request<Indexer[]>('/indexer');
  }

  async testAllIndexers(): Promise<Array<{
    id: number;
    isValid: boolean;
    validationFailures: Array<{ propertyName: string; errorMessage: string }>;
  }>> {
    return this.request('/indexer/testall', { method: 'POST' });
  }

  async getIndexerStats(): Promise<{ indexers: IndexerStats[] }> {
    return this.request<{ indexers: IndexerStats[] }>('/indexerstats');
  }

  async search(query: string, categories?: number[]): Promise<unknown[]> {
    const params = new URLSearchParams({ query });
    if (categories) categories.forEach(c => params.append('categories', c.toString()));
    return this.request<unknown[]>(`/search?${params.toString()}`);
  }

  async getHistory(page = 1, pageSize = 20, indexerId?: number): Promise<{ records: ProwlarrHistoryRecord[]; totalRecords: number }> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (indexerId !== undefined) params.set('indexerId', String(indexerId));
    return this.request<{ records: ProwlarrHistoryRecord[]; totalRecords: number }>(`/history?${params.toString()}`);
  }

  async getTags(): Promise<Tag[]> {
    return this.request<Tag[]>('/tag');
  }

  async getDownloadClients(): Promise<DownloadClient[]> {
    return this.request<DownloadClient[]>('/downloadclient');
  }

  async getApplications(): Promise<ProwlarrApplication[]> {
    return this.request<ProwlarrApplication[]>('/applications');
  }
}
