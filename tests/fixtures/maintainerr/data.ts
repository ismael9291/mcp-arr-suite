export const settingsFixture = {
  id: 1,
  plex_name: 'My Plex Server',
  plex_hostname: '192.168.1.10',
  plex_port: 32400,
  plex_ssl: 0,
  plex_auth_token: 'fake-plex-token',
  overseerr_url: 'http://overseerr:5055',
  overseerr_api_key: 'fake-overseerr-key',
  collection_handler_job_cron: '0 0-23/12 * * *',
  rules_handler_job_cron: '0 0-23/8 * * *',
};

export const ruleFixture = {
  id: 1,
  name: 'Unwatched Movies',
  description: 'Movies not watched in 2 years',
  libraryId: 1,
  dataType: 1,
  isActive: true,
  arrAction: 0,
  useRules: true,
  listExclusions: true,
  forceOverseerr: false,
  manualCollection: false,
  deleteAfterDays: 0,
  rules: [
    {
      customVal: { ruleTypeId: 0, value: '63072000' },
      operator: null,
      firstVal: [0, 7],
      action: 5,
      section: 0,
    },
  ],
};

export const collectionFixture = {
  id: 1,
  title: 'Unwatched Movies',
  isActive: true,
  arrAction: 0,
  deleteAfterDays: 0,
  manualCollection: false,
  libraryId: 1,
  type: 1,
};

export const collectionMediaFixture = [
  { id: 1, collectionId: 1, plexId: 12345, title: 'Some Movie', addDate: '2024-01-01' },
  { id: 2, collectionId: 1, plexId: 67890, title: 'Another Movie', addDate: '2024-02-01' },
];

export const exclusionFixture = {
  id: 1,
  plexId: 12345,
  ruleGroupId: 1,
};

export const plexLibrariesFixture = [
  { key: '1', type: 'movie', title: 'Movies' },
  { key: '2', type: 'show', title: 'TV Shows' },
];

export const ruleConstantsFixture = {
  applications: [
    {
      id: 0,
      name: 'Plex',
      props: [
        { id: 0, humanName: 'Date added', mediaType: 0, type: { key: 'date', possibilities: [5, 6, 7, 8] } },
        { id: 7, humanName: 'Last view date', mediaType: 0, type: { key: 'date', possibilities: [5, 6, 7, 8] } },
      ],
    },
    { id: 1, name: 'Radarr', props: [] },
    { id: 2, name: 'Sonarr', props: [] },
  ],
};
