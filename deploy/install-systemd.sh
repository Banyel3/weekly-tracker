#!/usr/bin/env bash
# Installs the user units next to this script and starts the stack. Run on the server as the deploy user:
#   bash ~/weekly-tracker/deploy/install-systemd.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$HOME/.config/systemd/user"
mkdir -p "$dest"
cp "$here"/weekly-tracker.service "$here"/weekly-tracker-backup.service "$here"/weekly-tracker-backup.timer "$dest/"
systemctl --user daemon-reload
systemctl --user enable --now weekly-tracker.service
systemctl --user enable --now weekly-tracker-backup.timer
if [ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null)" != "yes" ]; then
  echo "linger is off: run 'sudo loginctl enable-linger $USER' once so the units start at boot without a login"
fi
systemctl --user --no-pager status weekly-tracker.service | head -5
systemctl --user --no-pager list-timers weekly-tracker-backup.timer | head -3
