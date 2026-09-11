#!/usr/bin/env bash
# Start the production standalone server with Node inspector for debugging.
# Usage: npm run start:debug
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .next/standalone/server.js ]]; then
  echo "No standalone build found. Run: npm run build:debug" >&2
  exit 1
fi

# Standalone server expects static assets next to itself (same as Dockerfile).
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -R .next/static .next/standalone/.next/static
if [[ -d public ]]; then
  rm -rf .next/standalone/public
  cp -R public .next/standalone/public
fi

export NODE_ENV=production
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export NODE_OPTIONS="${NODE_OPTIONS:---inspect=0.0.0.0:9229}"

echo "Debugger listening (NODE_OPTIONS=$NODE_OPTIONS)"
echo "App: http://localhost:${PORT}  |  Health: /api/health  |  Attach: port 9229"
cd .next/standalone
exec node server.js
