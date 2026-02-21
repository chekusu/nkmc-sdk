#!/usr/bin/env bash
set -euo pipefail

# Ensure authenticated
nkmc auth 2>/dev/null || true

echo "=== Step 1: List all services ==="
nkmc ls /

echo ""
echo "=== Step 2: Search for weather-related services ==="
nkmc grep "weather" /

echo ""
echo "=== Step 3: Read weather API skill.md ==="
nkmc cat /api.weather.gov/skill.md

echo ""
echo "=== Step 4: List weather API contents ==="
nkmc ls /api.weather.gov/
