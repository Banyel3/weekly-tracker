#!/usr/bin/env bash
# Targets the compose project in this directory; COMPOSE_PROJECT_NAME picks another one, BACKUP_DIR another folder.
set -euo pipefail
cd "$(dirname "$0")/.."

raw="${BACKUP_KEEP_DAYS:-$(sed -n 's/^BACKUP_KEEP_DAYS=//p' .env 2>/dev/null | tail -n 1)}"
keep="$(printf '%s' "$raw" | tr -d "\"' \t\r")"
case "$keep" in
  '' | *[!0-9]*) keep=30 ;;
esac

dir="${BACKUP_DIR:-backups}"
mkdir -p "$dir"
file="$dir/weekly-tracker-$(date +%Y%m%d-%H%M).sql.gz"
tmp="$file.tmp"
trap 'rm -f "$tmp"' EXIT
docker compose exec -T db pg_dump -U tracker -d tracker --clean --if-exists | gzip > "$tmp"
mv "$tmp" "$file"
find "$dir" -name 'weekly-tracker-*.sql.gz' -type f -mtime +"$keep" -delete
echo "$file"
