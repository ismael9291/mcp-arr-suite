# mcp-arr-suite

MCP server for the \*arr media management suite — Sonarr, Radarr, Lidarr, Prowlarr, and SABnzbd.

Exposes your media services as MCP tools consumable by Claude or any MCP-capable client. 215 tools across 7 modules.

<img width="854" height="739" alt="MCP Suite Image Diagram" src="https://github.com/user-attachments/assets/099d2cb3-ff71-4a27-8816-6e0d66f22a7a" />

## Requirements

- Node.js >= 18
- At least one service running and accessible

## Install

**Via npm (recommended):**

```bash
npm install -g mcp-arr-suite
```

**From source:**

```bash
git clone https://github.com/ismael9291/mcp-arr-suite.git
cd mcp-arr-suite
npm install && npm run build
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
| `SABNZBD_URL` | SABnzbd base URL (e.g. `http://localhost:8080`) |
| `SABNZBD_API_KEY` | SABnzbd API key (from `sabnzbd.ini`, field `api_key`) |

Tools are only registered for services that are configured.

## MCP Client Setup

Example Claude Desktop / Claude Code config (npm install):

```json
{
  "mcpServers": {
    "mcp-arr-suite": {
      "command": "mcp-arr-suite",
      "env": {
        "SONARR_URL": "http://localhost:8989",
        "SONARR_API_KEY": "...",
        "RADARR_URL": "http://localhost:7878",
        "RADARR_API_KEY": "...",
        "PROWLARR_URL": "http://localhost:9696",
        "PROWLARR_API_KEY": "...",
        "SABNZBD_URL": "http://localhost:8080",
        "SABNZBD_API_KEY": "..."
      }
    }
  }
}
```

If running from source, replace `"command": "mcp-arr-suite"` with:

```json
"command": "node",
"args": ["/path/to/mcp-arr-suite/dist/index.js"],
```

## Tools

### Cross-service (always available)
| Tool | Description |
|---|---|
| `arr_status` | Connection status and version for all configured services |
| `arr_search_all` | Search across all configured media services simultaneously |

### Sonarr — 54 tools
| Category | Tools |
|---|---|
| Library | `sonarr_get_series`, `sonarr_search`, `sonarr_add_series`, `sonarr_delete_series`, `sonarr_update_series`, `sonarr_bulk_update_series`, `sonarr_bulk_delete_series` |
| Episodes | `sonarr_get_episodes`, `sonarr_get_episode_files`, `sonarr_delete_episode_file`, `sonarr_delete_episode_files_bulk`, `sonarr_monitor_episodes`, `sonarr_season_pass` |
| Search & import | `sonarr_search_missing`, `sonarr_search_episode`, `sonarr_search_releases`, `sonarr_grab_release`, `sonarr_get_manual_import`, `sonarr_process_manual_import` |
| Queue | `sonarr_get_queue`, `sonarr_remove_from_queue`, `sonarr_get_wanted_missing`, `sonarr_get_wanted_cutoff` |
| History & blocklist | `sonarr_get_history`, `sonarr_get_blocklist`, `sonarr_delete_from_blocklist` |
| Quality & formats | `sonarr_get_quality_profiles`, `sonarr_get_quality_profile`, `sonarr_update_quality_profile`, `sonarr_update_quality_definition`, `sonarr_list_custom_formats`, `sonarr_get_custom_format`, `sonarr_create_custom_format`, `sonarr_update_custom_format`, `sonarr_delete_custom_format` |
| Config | `sonarr_get_import_lists`, `sonarr_update_import_list`, `sonarr_get_import_exclusions`, `sonarr_delete_import_exclusion`, `sonarr_get_tags`, `sonarr_create_tag`, `sonarr_delete_tag` |
| System | `sonarr_get_health`, `sonarr_get_disk_space`, `sonarr_get_root_folders`, `sonarr_get_download_clients`, `sonarr_get_naming`, `sonarr_get_system_tasks`, `sonarr_get_logs`, `sonarr_get_notifications`, `sonarr_get_calendar`, `sonarr_get_command_status` |
| Commands | `sonarr_refresh_series`, `sonarr_trigger_backup`, `sonarr_trigger_rss_sync`, `sonarr_trigger_refresh_monitored_downloads`, `sonarr_trigger_cutoff_unmet_search`, `sonarr_trigger_rescan_series`, `sonarr_trigger_rename_series`, `sonarr_trigger_downloaded_scan` |
| Overview | `sonarr_review_setup` |

### Radarr — 50 tools
| Category | Tools |
|---|---|
| Library | `radarr_get_movies`, `radarr_search`, `radarr_add_movie`, `radarr_delete_movie`, `radarr_update_movie`, `radarr_bulk_update_movies`, `radarr_bulk_delete_movies` |
| Files | `radarr_get_movie_files`, `radarr_delete_movie_file` |
| Search & import | `radarr_search_movie`, `radarr_search_releases`, `radarr_grab_release`, `radarr_get_manual_import`, `radarr_process_manual_import` |
| Queue | `radarr_get_queue`, `radarr_remove_from_queue`, `radarr_get_wanted_missing`, `radarr_get_wanted_cutoff` |
| History & blocklist | `radarr_get_history`, `radarr_get_blocklist`, `radarr_delete_from_blocklist` |
| Quality & formats | `radarr_get_quality_profiles`, `radarr_get_quality_profile`, `radarr_update_quality_profile`, `radarr_update_quality_definition`, `radarr_list_custom_formats`, `radarr_get_custom_format`, `radarr_create_custom_format`, `radarr_update_custom_format`, `radarr_delete_custom_format` |
| Config | `radarr_get_import_lists`, `radarr_update_import_list`, `radarr_get_import_exclusions`, `radarr_delete_import_exclusion`, `radarr_get_tags`, `radarr_create_tag`, `radarr_delete_tag` |
| System | `radarr_get_health`, `radarr_get_disk_space`, `radarr_get_root_folders`, `radarr_get_download_clients`, `radarr_get_naming`, `radarr_get_system_tasks`, `radarr_get_logs`, `radarr_get_notifications`, `radarr_get_calendar`, `radarr_get_command_status` |
| Commands | `radarr_refresh_movie`, `radarr_trigger_backup`, `radarr_trigger_rss_sync`, `radarr_trigger_refresh_monitored_downloads`, `radarr_trigger_cutoff_unmet_search`, `radarr_trigger_rescan_movies`, `radarr_trigger_rename_movies`, `radarr_trigger_missing_search`, `radarr_trigger_downloaded_scan` |
| Overview | `radarr_review_setup` |

### Lidarr — 49 tools
| Category | Tools |
|---|---|
| Library | `lidarr_get_artists`, `lidarr_search`, `lidarr_add_artist`, `lidarr_delete_artist`, `lidarr_update_artist` |
| Albums & files | `lidarr_get_albums`, `lidarr_get_album_by_id`, `lidarr_monitor_albums`, `lidarr_get_track_files`, `lidarr_delete_track_file` |
| Search | `lidarr_search_album`, `lidarr_search_missing` |
| Queue | `lidarr_get_queue`, `lidarr_remove_from_queue`, `lidarr_get_wanted_missing`, `lidarr_get_wanted_cutoff` |
| History & blocklist | `lidarr_get_history`, `lidarr_get_blocklist`, `lidarr_delete_from_blocklist` |
| Quality & formats | `lidarr_get_quality_profiles`, `lidarr_get_quality_profile`, `lidarr_update_quality_profile`, `lidarr_update_quality_definition`, `lidarr_list_custom_formats`, `lidarr_get_custom_format`, `lidarr_create_custom_format`, `lidarr_update_custom_format`, `lidarr_delete_custom_format` |
| Config | `lidarr_get_metadata_profiles`, `lidarr_get_import_lists`, `lidarr_update_import_list`, `lidarr_get_import_exclusions`, `lidarr_delete_import_exclusion`, `lidarr_get_tags`, `lidarr_create_tag`, `lidarr_delete_tag` |
| System | `lidarr_get_health`, `lidarr_get_disk_space`, `lidarr_get_root_folders`, `lidarr_get_download_clients`, `lidarr_get_naming`, `lidarr_get_system_tasks`, `lidarr_get_logs`, `lidarr_get_notifications`, `lidarr_get_calendar`, `lidarr_get_command_status` |
| Commands | `lidarr_refresh_artist`, `lidarr_trigger_backup`, `lidarr_trigger_rss_sync`, `lidarr_trigger_refresh_monitored_downloads`, `lidarr_trigger_cutoff_unmet_search`, `lidarr_trigger_rescan_artists`, `lidarr_trigger_rename_artists`, `lidarr_trigger_refresh_all_artists`, `lidarr_trigger_downloaded_scan` |
| Overview | `lidarr_review_setup` |

### Prowlarr — 24 tools
| Category | Tools |
|---|---|
| Indexers | `prowlarr_get_indexers`, `prowlarr_get_indexer`, `prowlarr_update_indexer`, `prowlarr_test_indexer`, `prowlarr_test_indexers`, `prowlarr_search` |
| Applications | `prowlarr_get_apps`, `prowlarr_update_app` |
| Stats & history | `prowlarr_get_stats`, `prowlarr_get_history` |
| Config | `prowlarr_get_tags`, `prowlarr_create_tag`, `prowlarr_delete_tag`, `prowlarr_get_download_clients`, `prowlarr_get_notifications`, `prowlarr_test_notification` |
| System | `prowlarr_get_status`, `prowlarr_get_health`, `prowlarr_get_logs`, `prowlarr_get_system_tasks`, `prowlarr_get_command_status` |
| Commands | `prowlarr_trigger_backup`, `prowlarr_trigger_rss_sync`, `prowlarr_sync_apps` |

### SABnzbd — 29 tools
| Category | Tools |
|---|---|
| Queue | `sabnzbd_get_queue`, `sabnzbd_pause`, `sabnzbd_resume`, `sabnzbd_set_priority`, `sabnzbd_set_speed_limit`, `sabnzbd_change_cat`, `sabnzbd_change_opts` |
| History | `sabnzbd_get_history`, `sabnzbd_retry`, `sabnzbd_retry_all`, `sabnzbd_mark_completed`, `sabnzbd_purge_failed` |
| Delete | `sabnzbd_delete`, `sabnzbd_delete_orphans` |
| Post-processing | `sabnzbd_pause_pp`, `sabnzbd_resume_pp`, `sabnzbd_add_orphans` |
| Add NZBs | `sabnzbd_add_url` |
| Config | `sabnzbd_get_cats`, `sabnzbd_get_scripts`, `sabnzbd_get_paths` |
| System | `sabnzbd_get_status`, `sabnzbd_get_warnings`, `sabnzbd_unblock_server`, `sabnzbd_server_stats`, `sabnzbd_version` |
| Triggers | `sabnzbd_rss_now`, `sabnzbd_watched_now`, `sabnzbd_get_files` |

### TRaSH Guides — 7 tools (always available)
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
# Unit tests (MSW mocks, no services required)
npm test

# Live smoke tests against real services
SONARR_URL=http://localhost:8989 SONARR_API_KEY=... \
RADARR_URL=http://localhost:7878 RADARR_API_KEY=... \
npm run test:live
```

Additional live test variables:

| Variable | Description |
|---|---|
| `MCP_ARR_LIVE_SEARCH_TERM` | Override default search term (default: `dune`) |
| `MCP_ARR_ENABLE_TRASH=1` | Include TRaSH Guides smoke tests |
| `MCP_ARR_ENABLE_COMMAND_SMOKE=1` | Include command tests (refresh, scan, trigger, etc.) |
| `RADARR_TEST_MOVIE_ID` | Movie ID for command smoke tests |
| `RADARR_TEST_DOWNLOADS_PATH` | Downloads path for `radarr_trigger_downloaded_scan` (default: `/downloads/complete`) |
| `SONARR_TEST_SERIES_ID` | Series ID for command smoke tests |
| `SONARR_TEST_EPISODE_ID` | Episode ID for release search tests |
| `SONARR_TEST_DOWNLOADS_PATH` | Downloads path for `sonarr_trigger_downloaded_scan` (default: `/downloads/complete`) |
| `SONARR_TEST_IMPORT_FOLDER` | Folder for manual import tests (default: `/tmp`) |
| `LIDARR_TEST_ARTIST_ID` | Artist ID for command smoke tests |

## API Documentation

- [Sonarr API](https://wiki.servarr.com/sonarr/api)
- [Radarr API](https://wiki.servarr.com/radarr/api)
- [Lidarr API](https://wiki.servarr.com/lidarr/api)
- [Prowlarr API](https://wiki.servarr.com/prowlarr/api)
- [SABnzbd API](https://sabnzbd.org/wiki/advanced/api)
- [TRaSH Guides](https://trash-guides.info)

## License

[MIT](LICENSE)
