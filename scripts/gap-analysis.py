#!/usr/bin/env python3
"""
MCP Gap Analysis
Compares methods available in arr-client.ts against methods actually called
by MCP tool handlers in the service files.

Usage: python3 scripts/gap-analysis.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
CLIENT_FILE = ROOT / "src/clients/arr-client.ts"
SERVICES_DIR = ROOT / "src/services"
SHARED_FILE = ROOT / "src/shared/config-tools.ts"

# Map service name -> client class name in arr-client.ts -> methods prefix in service files
SERVICES = {
    "sonarr": "SonarrClient",
    "radarr": "RadarrClient",
    "lidarr": "LidarrClient",
    "prowlarr": "ProwlarrClient",
}

BASE_CLASS = "ArrClient"


def extract_class_methods(ts_source: str, class_name: str) -> set[str]:
    """Extract all async method names from a class in TypeScript source."""
    # Find class body
    class_pattern = rf"class {class_name}[^{{]*\{{"
    match = re.search(class_pattern, ts_source)
    if not match:
        return set()

    # Find the class body by tracking braces
    start = match.end()
    depth = 1
    pos = start
    while pos < len(ts_source) and depth > 0:
        if ts_source[pos] == "{":
            depth += 1
        elif ts_source[pos] == "}":
            depth -= 1
        pos += 1

    class_body = ts_source[start:pos]

    # Extract async method names (skip private/protected helpers)
    methods = set(re.findall(r"(?:^|\n)\s{2}async (\w+)\s*\(", class_body))
    # Exclude the base request helper
    methods.discard("request")
    return methods


def extract_called_methods(service_source: str, service_name: str) -> set[str]:
    """Extract all client method names called in a service file."""
    pattern = rf"clients\.{service_name}\.(\w+)\s*\("
    return set(re.findall(pattern, service_source))


def extract_shared_called_methods(shared_source: str, service_name: str) -> set[str]:
    """Shared config-tools.ts uses 'client.' directly."""
    # config-tools uses `client.method()` not `clients.sonarr.method()`
    return set(re.findall(r"client\.(\w+)\s*\(", shared_source))


def main():
    client_source = CLIENT_FILE.read_text()
    shared_source = SHARED_FILE.read_text()

    # Base class methods (shared across all services)
    base_methods = extract_class_methods(client_source, BASE_CLASS)
    shared_called = extract_shared_called_methods(shared_source, "")

    print("=" * 70)
    print("MCP SUITE — GAP ANALYSIS")
    print(f"Source: {CLIENT_FILE.relative_to(ROOT)}")
    print("=" * 70)

    all_gaps: dict[str, list[str]] = {}

    for service, class_name in SERVICES.items():
        service_file = SERVICES_DIR / f"{service}.ts"
        if not service_file.exists():
            print(f"\n[!] Missing service file: {service_file}")
            continue

        service_source = service_file.read_text()

        # Methods specific to this service class
        service_methods = extract_class_methods(client_source, class_name)
        # All available methods = base + service-specific
        all_available = base_methods | service_methods

        # Methods actually used in the service tools
        called = extract_called_methods(service_source, service)
        # Also count shared tools (config-tools.ts covers some base methods for all services)
        called |= shared_called

        gaps = sorted(all_available - called)
        all_gaps[service] = gaps

        print(f"\n{'─' * 70}")
        print(f"  {service.upper()}  ({len(all_available)} client methods, {len(called)} used in tools)")
        print(f"  {len(gaps)} gaps:")
        if gaps:
            for g in gaps:
                src = "base" if g in base_methods else service
                print(f"    - {g}  [{src}]")
        else:
            print("    (none)")

    print(f"\n{'=' * 70}")
    total = sum(len(v) for v in all_gaps.values())
    print(f"Total gaps across all services: {total}")
    print("=" * 70)


if __name__ == "__main__":
    main()
