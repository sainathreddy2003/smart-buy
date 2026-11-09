#!/bin/sh
set -e

echo "[docker] Checking and seeding database..."
node src/seed/seed.js || echo "[docker] Seed step finished."

echo "[docker] Starting SmartBuy AI backend on port ${PORT:-5050}..."
exec node src/server.js
