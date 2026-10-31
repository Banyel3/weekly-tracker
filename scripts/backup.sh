#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

keep="${BACKUP_KEEP_DAYS:-$(sed -n 's/^BACKUP_KEEP_DAYS=//p' .env 2>/dev/null | tail -n 1)}"
mkdir -p backups
file="backups/weekly-tracker-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U tracker -d tracker --clean --if-exists | gzip > "$file"
find backups -name 'weekly-tracker-*.sql.gz' -type f -mtime +"${keep:-30}" -delete
echo "$file"
