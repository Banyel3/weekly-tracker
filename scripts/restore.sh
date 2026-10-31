#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: scripts/restore.sh <backup.sql.gz>" >&2
  exit 1
fi
file="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
cd "$(dirname "$0")/.."

gunzip -c "$file" | docker compose exec -T db psql -U tracker -d tracker -v ON_ERROR_STOP=1
