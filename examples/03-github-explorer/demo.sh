#!/usr/bin/env bash
set -euo pipefail

# Ensure authenticated
nkmc auth 2>/dev/null || true

echo "=== Step 1: Read GitHub API capabilities ==="
nkmc cat /api.github.com/skill.md

echo ""
echo "=== Step 2: List GitHub API endpoints ==="
nkmc ls /api.github.com/

echo ""
echo "=== Step 3: Get repository info ==="
nkmc cat /api.github.com/repos/anthropics/claude-code

echo ""
echo "=== Step 4: Search for issues ==="
nkmc grep "issues" /api.github.com/
