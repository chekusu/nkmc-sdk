#!/usr/bin/env bash
set -euo pipefail

# Ensure authenticated
nkmc auth 2>/dev/null || true

echo "=== Step 1: Read weather API capabilities ==="
nkmc cat /api.weather.gov/skill.md

echo ""
echo "=== Step 2: Fetch active weather alerts ==="
nkmc cat /api.weather.gov/alerts/active

echo ""
echo "=== Step 3: Search for forecast endpoints ==="
nkmc grep "forecast" /api.weather.gov/

echo ""
echo "=== Step 4: Get NYC forecast ==="
nkmc cat /api.weather.gov/gridpoints/OKX/33,37/forecast
