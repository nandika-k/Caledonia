# Service Opportunity Discord Bot

A Discord bot that can be invited to club servers, watches moderator-approved announcement channels, detects likely volunteering or service-hours posts, and stores the collected opportunities without a separate backend.

It requires hosted PostgreSQL-compatible storage, so your future app can read the same collected data. Use TigerData or Azure Database for PostgreSQL.

## What it collects

For matching posts, the bot saves:

- original post text, including embeds and attachment links
- app-ready fields: title, date text, location, organizer, confidence score
- server, channel, author, and post timestamp
- Discord jump link back to the original message
- first signup URL it can find
- service-hour count when the post says something like `3 service hours`
- review status, defaulting to `needs_review`

Keyword matching is intentionally conservative and every record keeps the original Discord link, so your team can review opportunities before sharing them.

## Discord setup

1. Create a Discord app in the Discord Developer Portal.
2. Add a bot user.
3. Under **Bot**, enable **Message Content Intent**.
4. Under **Installation**, enable **Guild Install**.
5. Use the `bot` and `applications.commands` scopes.
6. Give the bot these permissions:
   - View Channels
   - Read Message History
   - Send Messages
   - Use Slash Commands
   - Attach Files

Anyone can invite the bot if you make the install link public. Server moderators still control which channels are watched by running `/watch_here`.

## How continuous collection works

This bot is designed to run like a welcome bot:

1. Your team hosts one always-on bot process.
2. A club server invites the bot.
3. A moderator runs `/watch_here` once in each announcements channel they want monitored.
4. After that, every new message in that channel is checked automatically.
5. Matching volunteer/service posts are saved directly to the database.

No separate backend is required for collection. Your future app can read from the same TigerData or Azure PostgreSQL database.

## Local setup

```powershell
cd bot
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `.env` from `.env.example`, then set `DISCORD_TOKEN` and one hosted database connection string.

```powershell
py bot.py
```

For fast slash-command testing, set `TEST_GUILD_ID` to your test server ID. Leave it blank for public/global slash commands once you are ready.

## Database options

The bot intentionally does not write to local JSON or SQLite files. It exits on startup unless one hosted Postgres-compatible connection string is set.

### TigerData

TigerData is PostgreSQL-compatible, so use the service connection string:

```env
TIGERDATA_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

You can also put the same value in `DATABASE_URL`.

### Azure PostgreSQL

Azure Database for PostgreSQL also works with a normal PostgreSQL connection string:

```env
AZURE_POSTGRESQL_CONNECTIONSTRING=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

If deploying to Azure App Service or Azure Container Apps, store this as an app setting instead of committing it.

## Slash commands

- `/watch_here`: moderator command that starts collecting from the current channel
- `/unwatch_here`: moderator command that stops collecting from the current channel
- `/scan_recent limit:50`: moderator command that backfills recent messages in the current channel
- `/opportunities limit:5`: shows recent collected opportunities in the current server
- `/export_opportunities`: moderator command that exports collected opportunities as CSV
- `/service_bot_status`: moderator command showing watched channels and storage mode

## Hackathon demo flow

1. Invite the bot to a test server.
2. Put sample service posts in an announcements channel.
3. Run `/watch_here` in that channel.
4. Run `/scan_recent` to collect existing sample posts.
5. Run `/opportunities` to show the results.
6. Run `/export_opportunities` to download the CSV.

For a hosted demo, deploy the same bot to Azure and point it at TigerData or Azure PostgreSQL with one of the database URL variables above.

## Always-on Azure hosting

The included `Dockerfile` runs the bot as a long-lived worker process:

```powershell
docker build -t service-opportunity-bot .
docker run --env-file .env service-opportunity-bot
```

For Azure, use a service that keeps a container running, such as Azure Container Apps with `min replicas = 1`. Set these environment variables in Azure rather than committing them:

```env
DISCORD_TOKEN=...
TIGERDATA_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

or:

```env
DISCORD_TOKEN=...
AZURE_POSTGRESQL_CONNECTIONSTRING=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

If the bot process is stopped, Discord will not send it live messages. Once it starts again, moderators can run `/scan_recent` in a watched channel to catch up on recent announcements.
