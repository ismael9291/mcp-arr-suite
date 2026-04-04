import type { TrashQualityProfile, TrashCustomFormat, TrashQualitySize, TrashNaming, TrashCFGroup } from '../../../src/trash/client.js';

export const trashQualityProfileFixture: TrashQualityProfile = {
  trash_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
  name: 'Ultra-HD Bluray + WEB',
  trash_description: 'Highest quality profile for 4K content',
  group: 1,
  upgradeAllowed: true,
  cutoff: 'Remux-2160p',
  minFormatScore: 0,
  cutoffFormatScore: 10000,
  minUpgradeFormatScore: 1,
  language: 'English',
  items: [
    { name: 'Remux-2160p', allowed: true },
    { name: 'Bluray-2160p', allowed: true },
    { name: 'WEB 2160p', allowed: true, items: ['WEBRip-2160p', 'WEBDL-2160p'] },
    { name: 'Bluray-1080p', allowed: false },
  ],
  formatItems: {
    HDR10: '10',
    'Dolby Vision': '20',
    'TrueHD Atmos': '5',
  },
};

export const trashCustomFormatFixtures: TrashCustomFormat[] = [
  {
    trash_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb01',
    trash_scores: { default: 10 },
    name: 'HDR10',
    includeCustomFormatWhenRenaming: false,
    specifications: [
      {
        name: 'HDR10',
        implementation: 'ReleaseTitleSpecification',
        negate: false,
        required: true,
        fields: { value: '\\bHDR10\\b' },
      },
    ],
  },
  {
    trash_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb02',
    trash_scores: { default: 20 },
    name: 'Dolby Vision',
    includeCustomFormatWhenRenaming: false,
    specifications: [
      {
        name: 'Dolby Vision',
        implementation: 'ReleaseTitleSpecification',
        negate: false,
        required: true,
        fields: { value: '\\b(DV|DoVi|Dolby\\.Vision)\\b' },
      },
    ],
  },
];

export const trashQualitySizeFixtures: TrashQualitySize[] = [
  {
    trash_id: 'cccccccccccccccccccccccccccccccc01',
    type: 'movies',
    qualities: [
      { quality: 'Remux-2160p', min: 69.1, preferred: 200, max: 400 },
      { quality: 'Bluray-2160p', min: 25, preferred: 100, max: 200 },
      { quality: 'Bluray-1080p', min: 5, preferred: 20, max: 50 },
    ],
  },
];

export const trashNamingFixtures: Record<string, TrashNaming> = {
  radarr: {
    folder: {
      'default': '{Movie CleanTitle} {(Release Year)} {tmdb-{TmdbId}}',
      'plex-imdb': '{Movie CleanTitle} {(Release Year)} {imdb-{ImdbId}}',
      'emby-imdb': '{Movie CleanTitle} {(Release Year)} {imdb-{ImdbId}}',
      'jellyfin-imdb': '{Movie CleanTitle} {(Release Year)} {imdb-{ImdbId}}',
    },
    file: {
      'default': '{Movie CleanTitle} {(Release Year)} {Edition Tags} {[Custom Formats]} {[Quality Full]} {[MediaInfo 3D]} {[Mediainfo VideoDynamicRangeType]} {[Mediainfo AudioCodec}{ Mediainfo AudioChannels}] {[Mediainfo VideoCodec]} {-Release Group}',
      'standard': '{Movie CleanTitle} {(Release Year)} {Quality Full} {-Release Group}',
      'plex-imdb': '{Movie CleanTitle} {(Release Year)} {imdb-{ImdbId}} {Quality Full} {-Release Group}',
      'emby-imdb': '{Movie CleanTitle} {(Release Year)} {imdb-{ImdbId}} {Quality Full} {-Release Group}',
      'jellyfin-imdb': '{Movie CleanTitle} {(Release Year)} {imdb-{ImdbId}} {Quality Full} {-Release Group}',
    },
  },
  sonarr: {
    folder: '{Series TitleYear}',
    file: '{Series TitleYear} - S{season:00}E{episode:00} - {Episode CleanTitle} [{Preferred Words }{Quality Full}]{[MediaInfo VideoDynamicRangeType]}{[Mediainfo AudioCodec}{ Mediainfo AudioChannels]}[{MediaInfo VideoCodec}]{-Release Group}',
    season: 'Season {season:00}',
    series: '{Series TitleYear}',
    specials: 'Specials',
  },
};

export const trashCFGroupFixtures: TrashCFGroup[] = [
  {
    name: 'HDR Formats',
    trash_id: 'dddddddddddddddddddddddddddddddd01',
    trash_description: 'Various HDR format custom formats',
    default: 'HDR10',
    custom_formats: [
      { name: 'HDR10', trash_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb01', required: false },
      { name: 'Dolby Vision', trash_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb02', required: false },
    ],
  },
];
