# Weekly Tracker

A single-user, self-hosted weekly to-do kanban board. Tasks live in four columns: Backlog, This Week, In Progress and Done. The three week columns show only the current week; Backlog is persistent. It is built with Next.js, Prisma and PostgreSQL, and runs with Docker Compose.

## Run

1. Copy `.env.example` to `.env`. This is optional and only needed for Telegram reminders.
2. Run `docker compose up`. After pulling changes, run `docker compose up --build`; the image build needs internet access (npm registry and Google Fonts for Geist).
3. Open `http://localhost:3000`.

Database migrations are applied automatically when the app container starts.

## Data

Tasks are stored in the named Docker volume `pgdata`. The data survives `docker compose down`. Running `docker compose down -v` deletes the volume and all tasks with it.

## Telegram reminders (optional)

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`. When both are set, the app sends a message every day at 09:00 Asia/Manila time listing the tasks due that day. If nothing is due, no message is sent. When either variable is empty, reminders are disabled.

## How the week works

A week is the ISO week, Monday to Sunday, in the Asia/Manila timezone. Rollover runs every Monday at 00:00 Asia/Manila, and also once each time the server starts to catch up on any missed rollover. At rollover, tasks from a past week that are Done are archived and leave the board; all other unfinished tasks from a past week move back to Backlog.

## Local development

1. Run `npm install`.
2. Start Postgres only: `docker compose up db`. It listens on host port 5433.
3. Copy `.env.example` to `.env` so `DATABASE_URL` points at that database.
4. Run `npx prisma migrate dev`.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Run `npm test` for the unit tests.
