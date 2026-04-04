# mcp-arr-suite

MCP server for the \*arr media management suite — Sonarr, Radarr, Lidarr, and Prowlarr.

Exposes your \*arr services as MCP tools consumable by Claude or any MCP-capable client.

## Requirements

- Node.js >= 18
- At least one \*arr service running and accessible

## Install & Build

```bash
npm install
npm run build
```

## Configuration

All configuration is via environment variables. Set at least one service pair:

| Variable | Description |
|---|---|
| `SONARR_URL` | Sonarr base URL (e.g. `http://localhost:8989`) |
| `SONARR_API_KEY` | Sonarr API key |
| `RADARR_URL` | Radarr base URL (e.g. `http://localhost:7878`) |
| `RADARR_API_KEY` | Radarr API key |
| `LIDARR_URL` | Lidarr base URL (e.g. `http://localhost:8686`) |
| `LIDARR_API_KEY` | Lidarr API key |
| `PROWLARR_URL` | Prowlarr base URL (e.g. `http://localhost:9696`) |
| `PROWLARR_API_KEY` | Prowlarr API key |

## MCP Client Setup

Example Claude Desktop config:

```json
{
  "mcpServers": {
    "mcp-arr-suite": {
      "command": "node",
      "args": ["/path/to/mcpSuite/dist/index.js"],
      "env": {
        "RADARR_URL": "http://localhost:7878",
        "RADARR_API_KEY": "...",
        "SONARR_URL": "http://localhost:8989",
        "SONARR_API_KEY": "..."
      }
    }
  }
}
```

## Tools

Tools are only registered for configured services.

### Cross-service
| Tool | Description |
|---|---|
| `arr_status` | Connection status and version for all configured services |
| `arr_search_all` | Search across all configured services simultaneously |

### Sonarr (TV)
| Tool | Description |
|---|---|
| `sonarr_get_series` | List library with pagination and title filter |
| `sonarr_search` | Search for a series by name (returns tvdbId for adding) |
| `sonarr_add_series` | Add a series |
| `sonarr_delete_series` | Remove a series, optionally deleting files |
| `sonarr_update_series` | Update monitored status, quality profile, tags |
| `sonarr_get_episodes` | List episodes for a series, optionally by season |
| `sonarr_get_episode_files` | File details for all episodes in a series |
| `sonarr_delete_episode_file` | Delete a specific episode file from disk |
| `sonarr_search_missing` | Trigger search for all missing episodes in a series |
| `sonarr_search_episode` | Trigger search for specific episode(s) |
| `sonarr_refresh_series` | Trigger metadata refresh |
| `sonarr_monitor_episodes` | Bulk set monitored/unmonitored on episodes |
| `sonarr_season_pass` | Bulk set monitored status per season |
| `sonarr_get_queue` | Current download queue |
| `sonarr_remove_from_queue` | Remove queue items, optionally blocklisting |
| `sonarr_get_calendar` | Upcoming episode air dates |
| `sonarr_get_history` | Download history, optionally filtered by series |
| `sonarr_get_wanted_missing` | Monitored episodes not yet downloaded |
| `sonarr_get_wanted_cutoff` | Episodes that haven't met the quality cutoff |
| `sonarr_get_blocklist` | Blocked/failed releases |
| `sonarr_delete_from_blocklist` | Remove a blocklist entry |
| `sonarr_get_disk_space` | Disk space for all root folders |
| `sonarr_get_quality_profiles` | Quality profiles |
| `sonarr_get_health` | Health check warnings |
| `sonarr_get_root_folders` | Root folders and free space |
| `sonarr_get_download_clients` | Download client configuration |
| `sonarr_get_naming` | File and folder naming configuration |
| `sonarr_get_tags` | All tags |
| `sonarr_review_setup` | Full configuration review in one call |

### Radarr (Movies)
| Tool | Description |
|---|---|
| `radarr_get_movies` | List library with pagination and title filter |
| `radarr_search` | Search for a movie by name (returns tmdbId for adding) |
| `radarr_add_movie` | Add a movie |
| `radarr_delete_movie` | Remove a movie, optionally deleting files |
| `radarr_update_movie` | Update monitored status, quality profile, availability, tags |
| `radarr_get_movie_files` | File details for a movie |
| `radarr_delete_movie_file` | Delete a specific movie file from disk |
| `radarr_search_movie` | Trigger download search for a library movie |
| `radarr_refresh_movie` | Trigger metadata refresh |
| `radarr_get_queue` | Current download queue |
| `radarr_remove_from_queue` | Remove queue items, optionally blocklisting |
| `radarr_get_calendar` | Upcoming movie releases |
| `radarr_get_history` | Download history, optionally filtered by movie |
| `radarr_get_wanted_missing` | Monitored movies not yet downloaded |
| `radarr_get_wanted_cutoff` | Movies that haven't met the quality cutoff |
| `radarr_get_blocklist` | Blocked/failed releases |
| `radarr_delete_from_blocklist` | Remove a blocklist entry |
| `radarr_get_disk_space` | Disk space for all root folders |
| `radarr_get_quality_profiles` | Quality profiles |
| `radarr_get_health` | Health check warnings |
| `radarr_get_root_folders` | Root folders and free space |
| `radarr_get_download_clients` | Download client configuration |
| `radarr_get_naming` | File and folder naming configuration |
| `radarr_get_tags` | All tags |
| `radarr_review_setup` | Full configuration review in one call |

### Lidarr (Music)
| Tool | Description |
|---|---|
| `lidarr_get_artists` | List library with pagination and name filter |
| `lidarr_search` | Search for an artist by name (returns foreignArtistId for adding) |
| `lidarr_add_artist` | Add an artist |
| `lidarr_get_albums` | Albums for an artist with download status |
| `lidarr_search_album` | Trigger download search for a specific album |
| `lidarr_search_missing` | Trigger search for all missing albums for an artist |
| `lidarr_get_queue` | Current download queue |
| `lidarr_get_calendar` | Upcoming album releases |
| `lidarr_get_metadata_profiles` | Metadata profiles (required when adding artists) |
| `lidarr_get_quality_profiles` | Quality profiles |
| `lidarr_get_health` | Health check warnings |
| `lidarr_get_root_folders` | Root folders and free space |
| `lidarr_get_download_clients` | Download client configuration |
| `lidarr_get_naming` | File and folder naming configuration |
| `lidarr_get_tags` | All tags |
| `lidarr_review_setup` | Full configuration review in one call |

### Prowlarr (Indexers)
| Tool | Description |
|---|---|
| `prowlarr_get_indexers` | All configured indexers |
| `prowlarr_search` | Search across all indexers |
| `prowlarr_test_indexers` | Test all indexers and return health status |
| `prowlarr_get_stats` | Indexer query/grab statistics |
| `prowlarr_get_health` | Health check warnings |

### TRaSH Guides (always available)
| Tool | Description |
|---|---|
| `trash_list_profiles` | List recommended quality profiles from TRaSH Guides |
| `trash_get_profile` | Full profile details including custom format scores |
| `trash_list_custom_formats` | List custom formats, optionally filtered by category |
| `trash_get_naming` | Recommended naming conventions for your media server |
| `trash_get_quality_sizes` | Recommended min/max/preferred file sizes per quality |
| `trash_compare_profile` | Compare your quality profile against TRaSH recommendations |
| `trash_compare_naming` | Compare your naming config against TRaSH recommendations |

## Testing

```bash
# Unit tests (mocked, no services required)
npm test

# Live smoke tests against real services
RADARR_URL=http://localhost:7878 RADARR_API_KEY=... npm run test:live
```

Additional live test variables:

| Variable | Description |
|---|---|
| `MCP_ARR_LIVE_SEARCH_TERM` | Override default search term (default: `dune`) |
| `MCP_ARR_ENABLE_TRASH=1` | Include TRaSH Guides smoke tests |
| `MCP_ARR_ENABLE_COMMAND_SMOKE=1` | Include safe command tests (refresh, search) |
| `RADARR_TEST_MOVIE_ID` | Movie ID for command smoke tests |
| `SONARR_TEST_SERIES_ID` | Series ID for command smoke tests |
| `LIDARR_TEST_ARTIST_ID` | Artist ID for command smoke tests |

## License

MIT
