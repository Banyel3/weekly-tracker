# Weekly Tracker

Project management for one person, with the week as the unit and a board that resets itself every Monday.

A single-user, self-hosted weekly kanban. Tasks live in four columns: Backlog, This Week, In Progress and Done. The three week columns show only the current week; Backlog is persistent. Around the board there is a stats row, a week calendar, a weekly review page and a searchable archive. It is built with Next.js, Prisma and PostgreSQL, and runs with Docker Compose.

## Run

1. Copy `.env.example` to `.env`. This is optional and only needed for Telegram reminders.
2. Run `docker compose up -d --build`. Run the same command after every `git pull`: without `--build` Compose keeps running the old image. The image build needs internet access (npm registry and Google Fonts for Geist).
3. Open `http://localhost:3000` (bound to loopback only).

Database migrations are applied automatically when the app container starts.

## Data

Tasks are stored in the named Docker volume `pgdata`. The data survives `docker compose down`. Running `docker compose down -v` deletes the volume and all tasks with it.

## Telegram reminders (optional)

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`. When both are set, the app sends a morning digest every day at 09:00 Asia/Manila time and a week summary every Friday at 18:00. When either variable is empty, Telegram messages are disabled.

The morning digest opens with the date and the day of the week (`day 3 of 7`), then lists open tasks by due date in four sections: **Overdue** (with how many days late), **Due today**, **Due tomorrow** and **Later this week** (with the weekday). Due dates count in every column, Backlog included. Each task shows its project when it has one; each section lists at most 10 tasks and then `… and N more`. A last line gives the In progress count against the WIP limit, how many tasks are open this week, and how many were carried from last week. On a quiet day, when nothing is overdue or due today or tomorrow, the digest says `Nothing due today · N open this week` and still shows the rest of the week; on an empty week it says `Nothing planned this week. Easy day.` A digest is sent every day, quiet or not.

## Server deployment (Ubuntu, no sudo)

The stack runs as a normal user on the laptop server and starts at boot through user-level systemd units in `deploy/`.

```sh
git clone https://github.com/Banyel3/weekly-tracker.git ~/weekly-tracker   # plus .env (chmod 600)
mkdir -p ~/.docker/cli-plugins && curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose && chmod +x ~/.docker/cli-plugins/docker-compose
bash ~/weekly-tracker/deploy/install-systemd.sh        # enables weekly-tracker.service and the nightly backup timer
tailscale serve --bg --https=8443 3000                 # tailnet-only HTTPS; keep Funnel off for this port
```

Then open `https://<server>.<tailnet>.ts.net:8443`. Requirements: the user is in the `docker` group and `loginctl enable-linger <user>` has been run once (needs sudo). Updates: `git pull && docker compose up -d --build`. Backups land in `backups/` (timer at 03:30, `BACKUP_KEEP_DAYS` from `.env`); restore with `scripts/restore.sh`.

## Agent API (optional)

Set `AGENT_API_TOKEN` in `.env` (generate one with `openssl rand -hex 32`) to let an AI agent operate the tracker over HTTP with `Authorization: Bearer <token>`.
`GET /api/agent/tools` returns twelve Anthropic tool definitions; `POST /api/agent/run` runs one, and REST shortcuts such as `GET /api/agent/today` return the same results.
Without the token every `/api/agent/**` route answers 503; the board's own routes are unaffected.
See [docs/agent-api.md](docs/agent-api.md) for the tools, a curl walkthrough and the example loop in `docs/examples/yumi-loop.mjs`.

## How the week works

A week is the ISO week, Monday to Sunday, in the Asia/Manila timezone. Rollover runs every Monday at 00:00 Asia/Manila, again every hour as an idempotent check, and once each time the server starts, so a machine that slept through Monday midnight still rolls over. At rollover, tasks from a past week that are Done are archived and leave the board; all other unfinished tasks from a past week move back to Backlog.

With Telegram configured, a summary of the week is sent every Friday at 18:00. If the server was off at 09:00 or at Friday 18:00, the missed digest or summary is sent once when it starts again later that day.

## Run on a laptop over Tailscale

Prerequisites: Docker, and Tailscale installed and signed in on the laptop.

1. Clone the repo, copy `.env.example` to `.env` and fill it in.
2. Run `docker compose up -d --build`. The app listens on `127.0.0.1:3000` only, so it is not reachable from the LAN.
3. Run `tailscale serve --bg 3000`. Find the laptop's MagicDNS name with `tailscale status` (or the Tailscale admin console); the board is then at `https://<laptop>.<tailnet>.ts.net` for devices on your tailnet, with a managed HTTPS certificate. Use that name, not an IP address. The tailnet is the login; the app has no auth of its own.
4. Set Docker Desktop (or the Docker daemon) to start at boot. Both services use `restart: unless-stopped`, so the stack comes back after a reboot. `docker compose ps` shows the app's health from `/api/health`.

### Add to Home Screen

The app ships a web app manifest and icons, so it opens full screen like an app (there is no offline mode).

- **iPhone / iPad (Safari):** open `https://<laptop>.<tailnet>.ts.net`, tap Share, then **Add to Home Screen**, then **Add**.
- **Android (Chrome):** open the same address, tap the ⋮ menu, then **Add to Home screen** (or **Install app**), then **Install**.

The phone must be signed in to the same tailnet with the Tailscale app connected.

### Backups

`scripts/backup.sh` writes `backups/weekly-tracker-YYYYMMDD-HHMM.sql.gz` (through a `.tmp` file, so a failed dump never leaves a partial backup) and deletes backups older than `BACKUP_KEEP_DAYS` days (from the environment or `.env`; default 30). Run it daily from the host crontab. Cron runs with a minimal `PATH`, and on macOS `docker` lives in `/usr/local/bin` or `/opt/homebrew/bin`, so set `PATH` in the crontab:

```
PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin
0 3 * * * /path/to/weekly-tracker/scripts/backup.sh >> /tmp/weekly-tracker-backup.log 2>&1
```

`BACKUP_DIR` writes somewhere else; `COMPOSE_PROJECT_NAME` targets a different Compose project than the one named after the checkout folder.

Restore with `scripts/restore.sh backups/<file>.sql.gz` while the stack is running. It replaces the current data.

Moving to another machine: run `scripts/backup.sh` on the old machine and copy the file over; on the new one clone the repo, copy `.env`, run `docker compose up -d --build`, then `scripts/restore.sh <file>` and `tailscale serve --bg 3000`.

## Local development

1. Run `npm install`.
2. Start Postgres only, with its port published on host port 5433: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db`.
3. Copy `.env.example` to `.env` so `DATABASE_URL` points at that database.
4. Run `npx prisma migrate dev`.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Run `npm test` for the unit tests.
7. App icons live in `public/icons/`; after editing the glyph in `scripts/icons.sh`, rerun it (needs `rsvg-convert` from librsvg).
