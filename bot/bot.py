"""Inviteable Discord bot for collecting volunteer and service opportunities."""

import csv
import io
import os
import re
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import discord
import psycopg
from dotenv import load_dotenv

BOT_DIR = Path(__file__).resolve().parent
load_dotenv(BOT_DIR / ".env")
load_dotenv()


TOKEN = os.getenv("DISCORD_TOKEN")
TEST_GUILD_ID = os.getenv("TEST_GUILD_ID", "").strip()

def database_url() -> str:
    url = (
        os.getenv("DATABASE_URL")
        or os.getenv("TIGERDATA_DATABASE_URL")
        or os.getenv("AZURE_POSTGRESQL_CONNECTIONSTRING")
        or ""
    ).strip()
    if url:
        return url

    required = ("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD")
    if all(os.getenv(name) for name in required):
        user = quote_plus(os.environ["PGUSER"])
        password = quote_plus(os.environ["PGPASSWORD"])
        sslmode = os.getenv("PGSSLMODE", "require")
        return (
            f"postgresql://{user}:{password}"
            f"@{os.environ['PGHOST']}:{os.environ['PGPORT']}/{os.environ['PGDATABASE']}"
            f"?sslmode={sslmode}"
        )

    return ""


DATABASE_URL = database_url()
CHANNEL_IDS = {
    int(value.strip())
    for value in os.getenv("ANNOUNCEMENT_CHANNEL_IDS", "").split(",")
    if value.strip().isdigit()
}

SIGNAL_TERMS = (
    "volunteer",
    "volunteering",
    "community service",
    "service hours",
    "service opportunity",
    "give back",
    "food bank",
    "food pantry",
    "fundraiser",
    "donation drive",
    "cleanup",
    "clean up",
    "tutor",
    "mentoring",
    "blood drive",
    "habitat for humanity",
    "soup kitchen",
    "nonprofit",
)
URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
HOURS_RE = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(?:volunteer|service|community service)?\s*hours?\b",
    re.IGNORECASE,
)
DATE_RE = re.compile(
    r"\b(?:date|when)\s*:\s*([^\n]+)|"
    r"\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?)\b",
    re.IGNORECASE,
)
LOCATION_RE = re.compile(r"\b(?:location|where)\s*:\s*([^\n]+)", re.IGNORECASE)
ORGANIZER_RE = re.compile(r"\b(?:host|hosted by|organizer|organization|club)\s*:\s*([^\n]+)", re.IGNORECASE)


def prepare_sql(sql: str) -> str:
    return re.sub(r":([A-Za-z_][A-Za-z0-9_]*)", r"%(\1)s", sql)


@contextmanager
def db_connection():
    if not DATABASE_URL:
        raise RuntimeError(
            "Set DATABASE_URL, TIGERDATA_DATABASE_URL, or "
            "AZURE_POSTGRESQL_CONNECTIONSTRING for hosted Postgres storage."
        )
    with psycopg.connect(DATABASE_URL) as db:
        yield db


def execute(sql: str, params: dict[str, Any] | None = None) -> int:
    with db_connection() as db:
        cursor = db.execute(prepare_sql(sql), params or {})
        return cursor.rowcount


def fetch_all(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with db_connection() as db:
        cursor = db.execute(prepare_sql(sql), params or {})
        rows = cursor.fetchall()
        if not rows:
            return []
        columns = [column[0] for column in cursor.description]
        return [dict(zip(columns, row)) for row in rows]


def table_columns(table_name: str) -> set[str]:
    rows = fetch_all("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = :table_name
    """, {"table_name": table_name})
    return {str(row["column_name"]) for row in rows}


def init_db():
    execute("""
        CREATE TABLE IF NOT EXISTS opportunities (
            message_id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            guild_name TEXT,
            channel_id TEXT NOT NULL,
            channel_name TEXT NOT NULL,
            author TEXT NOT NULL,
            posted_at TEXT NOT NULL,
            message_url TEXT NOT NULL,
            title TEXT,
            text TEXT NOT NULL,
            signup_url TEXT,
            hours REAL,
            date_text TEXT,
            location TEXT,
            organizer TEXT,
            confidence REAL,
            status TEXT NOT NULL DEFAULT 'needs_review',
            collected_at TEXT NOT NULL
        )
    """)
    existing_columns = table_columns("opportunities")
    for column_name, column_type in (
        ("guild_name", "TEXT"),
        ("title", "TEXT"),
        ("date_text", "TEXT"),
        ("location", "TEXT"),
        ("organizer", "TEXT"),
        ("confidence", "REAL"),
    ):
        if column_name not in existing_columns:
            execute(f"ALTER TABLE opportunities ADD COLUMN {column_name} {column_type}")
    execute("""
        CREATE TABLE IF NOT EXISTS monitored_channels (
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            channel_name TEXT NOT NULL,
            added_by TEXT NOT NULL,
            added_at TEXT NOT NULL,
            PRIMARY KEY (guild_id, channel_id)
        )
    """)
    execute("""
        CREATE INDEX IF NOT EXISTS opportunities_guild_posted_at_idx
        ON opportunities (guild_id, posted_at)
    """)
    execute("""
        CREATE INDEX IF NOT EXISTS opportunities_collected_at_idx
        ON opportunities (collected_at)
    """)


def watched_channel_ids() -> set[int]:
    rows = fetch_all("SELECT channel_id FROM monitored_channels")
    return {int(row["channel_id"]) for row in rows} | CHANNEL_IDS


def message_text(message: discord.Message) -> str:
    parts = [message.content] if message.content else []
    for embed in message.embeds:
        if embed.title:
            parts.append(embed.title)
        if embed.description:
            parts.append(embed.description)
        if embed.url:
            parts.append(embed.url)
        parts.extend(f"{field.name}: {field.value}" for field in embed.fields)
        if embed.footer and embed.footer.text:
            parts.append(embed.footer.text)
    for attachment in message.attachments:
        parts.append(attachment.url)
        if attachment.description:
            parts.append(attachment.description)
    return "\n".join(parts).strip()


def looks_relevant(text: str) -> bool:
    normalized = text.casefold()
    return any(term in normalized for term in SIGNAL_TERMS)


def clean_field(value: str | None) -> str | None:
    if not value:
        return None
    return value.strip(" \t\r\n.,;")


def first_meaningful_line(text: str) -> str | None:
    for line in text.splitlines():
        line = line.strip(" #*-")
        if line:
            return line[:180]
    return None


def confidence_score(text: str, signup_url: str | None, hours: float | None) -> float:
    normalized = text.casefold()
    score = 0.25
    if any(term in normalized for term in ("volunteer", "service hours", "community service")):
        score += 0.35
    if signup_url:
        score += 0.2
    if hours is not None:
        score += 0.1
    if any(term in normalized for term in ("sign up", "signup", "register", "rsvp", "form")):
        score += 0.1
    return min(score, 1.0)


def extract(text: str) -> dict[str, Any]:
    urls = URL_RE.findall(text)
    hours_match = HOURS_RE.search(text)
    date_match = DATE_RE.search(text)
    location_match = LOCATION_RE.search(text)
    organizer_match = ORGANIZER_RE.search(text)

    signup_url = urls[0].rstrip(".,)>]") if urls else None
    hours = float(hours_match.group(1)) if hours_match else None
    date_text = clean_field((date_match.group(1) or date_match.group(2)) if date_match else None)
    location = clean_field(location_match.group(1) if location_match else None)
    organizer = clean_field(organizer_match.group(1) if organizer_match else None)

    return {
        "title": first_meaningful_line(text),
        "signup_url": signup_url,
        "hours": hours,
        "date_text": date_text,
        "location": location,
        "organizer": organizer,
        "confidence": confidence_score(text, signup_url, hours),
    }


def build_record(message: discord.Message, text: str) -> dict[str, Any]:
    extracted = extract(text)
    return {
        "message_id": str(message.id),
        "guild_id": str(message.guild.id) if message.guild else "",
        "guild_name": message.guild.name if message.guild else "",
        "channel_id": str(message.channel.id),
        "channel_name": getattr(message.channel, "name", "unknown"),
        "author": str(message.author),
        "posted_at": message.created_at.isoformat(),
        "message_url": message.jump_url,
        "text": text,
        **extracted,
        "status": "needs_review",
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }


def save_record(record: dict[str, Any]) -> bool:
    rowcount = execute("""
        INSERT INTO opportunities
        (message_id, guild_id, guild_name, channel_id, channel_name, author,
         posted_at, message_url, title, text, signup_url, hours, date_text,
         location, organizer, confidence, status, collected_at)
        VALUES (:message_id, :guild_id, :guild_name, :channel_id, :channel_name,
                :author, :posted_at, :message_url, :title, :text, :signup_url,
                :hours, :date_text, :location, :organizer, :confidence,
                :status, :collected_at)
        ON CONFLICT(message_id) DO NOTHING
    """, record)
    return rowcount > 0


def opportunities_for_guild(guild_id: int, limit: int = 10) -> list[dict[str, Any]]:
    return fetch_all("""
        SELECT message_id, guild_name, channel_name, author, posted_at,
               message_url, title, text, signup_url, hours, date_text,
               location, organizer, confidence, status, collected_at
        FROM opportunities
        WHERE guild_id = :guild_id
        ORDER BY posted_at DESC
        LIMIT :limit
    """, {"guild_id": str(guild_id), "limit": limit})


def monitored_channels_for_guild(guild_id: int) -> list[dict[str, Any]]:
    return fetch_all("""
        SELECT channel_id, channel_name, added_by, added_at
        FROM monitored_channels
        WHERE guild_id = :guild_id
        ORDER BY channel_name
    """, {"guild_id": str(guild_id)})


async def maybe_collect(message: discord.Message) -> bool:
    if message.guild is None or message.author.bot:
        return False

    text = message_text(message)
    if not text or not looks_relevant(text):
        return False

    return save_record(build_record(message, text))


def row_to_line(row: dict[str, Any]) -> str:
    title = row.get("title") or "Service opportunity"
    text = " ".join(str(row.get("text", "")).split())
    if len(text) > 120:
        text = f"{text[:117]}..."
    hours = f" | {row['hours']} hrs" if row.get("hours") is not None else ""
    date_text = f" | {row['date_text']}" if row.get("date_text") else ""
    location = f" | {row['location']}" if row.get("location") else ""
    signup = f" | {row['signup_url']}" if row.get("signup_url") else ""
    return f"{title}\n#{row['channel_name']}{hours}{date_text}{location}{signup}\n{text}\n{row['message_url']}"


def rows_to_csv(rows: list[dict[str, Any]]) -> io.BytesIO:
    text_buffer = io.StringIO()
    fieldnames = [
        "posted_at",
        "guild_name",
        "channel_name",
        "author",
        "title",
        "hours",
        "date_text",
        "location",
        "organizer",
        "signup_url",
        "message_url",
        "confidence",
        "status",
        "text",
    ]
    writer = csv.DictWriter(text_buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return io.BytesIO(text_buffer.getvalue().encode("utf-8"))


intents = discord.Intents.default()
intents.message_content = True
intents.messages = True
client = discord.Client(intents=intents)
tree = discord.app_commands.CommandTree(client)


@tree.command(name="watch_here", description="Collect service opportunities posted in this channel")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def watch_here(interaction: discord.Interaction):
    if interaction.guild is None or not isinstance(interaction.channel, discord.abc.GuildChannel):
        await interaction.response.send_message(
            "Use this command in a server text or announcement channel.",
            ephemeral=True,
        )
        return

    execute("""
        INSERT INTO monitored_channels
        (guild_id, channel_id, channel_name, added_by, added_at)
        VALUES (:guild_id, :channel_id, :channel_name, :added_by, :added_at)
        ON CONFLICT(guild_id, channel_id) DO UPDATE SET
            channel_name = excluded.channel_name,
            added_by = excluded.added_by,
            added_at = excluded.added_at
    """, {
        "guild_id": str(interaction.guild.id),
        "channel_id": str(interaction.channel.id),
        "channel_name": interaction.channel.name,
        "added_by": str(interaction.user),
        "added_at": datetime.now(timezone.utc).isoformat(),
    })
    await interaction.response.send_message(
        f"I'll collect likely service opportunity posts from {interaction.channel.mention}. "
        "Use `/scan_recent` to backfill recent announcements.",
        ephemeral=True,
    )


@tree.command(name="unwatch_here", description="Stop collecting from this channel")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def unwatch_here(interaction: discord.Interaction):
    if interaction.guild is None or interaction.channel is None:
        await interaction.response.send_message("Use this command in a server channel.", ephemeral=True)
        return
    rowcount = execute("""
        DELETE FROM monitored_channels
        WHERE guild_id = :guild_id AND channel_id = :channel_id
    """, {
        "guild_id": str(interaction.guild.id),
        "channel_id": str(interaction.channel.id),
    })
    message = "Stopped monitoring this channel." if rowcount else "This channel was not configured for monitoring."
    await interaction.response.send_message(message, ephemeral=True)


@tree.command(name="scan_recent", description="Scan recent messages in this channel for service opportunities")
@discord.app_commands.describe(limit="How many recent messages to scan, up to 200")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def scan_recent(interaction: discord.Interaction, limit: discord.app_commands.Range[int, 1, 200] = 50):
    if interaction.guild is None or not hasattr(interaction.channel, "history"):
        await interaction.response.send_message("Use this command in a server text or announcement channel.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True, thinking=True)
    scanned = 0
    collected = 0
    async for message in interaction.channel.history(limit=limit):
        scanned += 1
        if await maybe_collect(message):
            collected += 1

    await interaction.followup.send(
        f"Scanned {scanned} recent messages in {interaction.channel.mention} and saved {collected} new opportunities.",
        ephemeral=True,
    )


@tree.command(name="opportunities", description="Show recently collected service opportunities")
@discord.app_commands.describe(limit="How many opportunities to show, up to 10")
async def opportunities(interaction: discord.Interaction, limit: discord.app_commands.Range[int, 1, 10] = 5):
    if interaction.guild is None:
        await interaction.response.send_message("Use this command in a server.", ephemeral=True)
        return

    rows = opportunities_for_guild(interaction.guild.id, limit)
    if not rows:
        await interaction.response.send_message(
            "No opportunities collected yet. A moderator can run `/watch_here` in announcement channels.",
            ephemeral=True,
        )
        return

    body = "\n\n".join(row_to_line(row) for row in rows)
    await interaction.response.send_message(body[:1900], ephemeral=True)


@tree.command(name="export_opportunities", description="Export collected service opportunities as CSV")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def export_opportunities(interaction: discord.Interaction):
    if interaction.guild is None:
        await interaction.response.send_message("Use this command in a server.", ephemeral=True)
        return

    rows = opportunities_for_guild(interaction.guild.id, limit=500)
    if not rows:
        await interaction.response.send_message("No opportunities collected yet.", ephemeral=True)
        return

    file = discord.File(rows_to_csv(rows), filename="service-opportunities.csv")
    await interaction.response.send_message(
        f"Exported {len(rows)} collected opportunities.",
        file=file,
        ephemeral=True,
    )


@tree.command(name="service_bot_status", description="Show watched channels and storage mode")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def service_bot_status(interaction: discord.Interaction):
    if interaction.guild is None:
        await interaction.response.send_message("Use this command in a server.", ephemeral=True)
        return

    rows = monitored_channels_for_guild(interaction.guild.id)
    watched = ", ".join(f"<#{row['channel_id']}>" for row in rows) if rows else "No channels configured yet."
    await interaction.response.send_message(
        f"Storage: hosted PostgreSQL/TigerData/Azure\nWatched channels: {watched}",
        ephemeral=True,
    )


@tree.error
async def on_app_command_error(interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
    if isinstance(error, discord.app_commands.MissingPermissions):
        message = "You need the Manage Server permission to use that command."
    else:
        message = f"Command failed: {error}"

    if interaction.response.is_done():
        await interaction.followup.send(message, ephemeral=True)
    else:
        await interaction.response.send_message(message, ephemeral=True)


@client.event
async def on_ready():
    if not getattr(client, "commands_synced", False):
        if TEST_GUILD_ID.isdigit():
            guild = discord.Object(id=int(TEST_GUILD_ID))
            tree.copy_global_to(guild=guild)
            await tree.sync(guild=guild)
            print(f"Test commands synced to server {TEST_GUILD_ID}.")
        else:
            await tree.sync()
            print("Global commands synced; Discord can take time to show them.")
        client.commands_synced = True
    print(f"Connected as {client.user}; storage=hosted postgres.")


@client.event
async def on_message(message: discord.Message):
    if message.channel.id not in watched_channel_ids():
        return
    if await maybe_collect(message):
        print(f"Collected opportunity from #{getattr(message.channel, 'name', 'unknown')}: {message.jump_url}")


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("Set DISCORD_TOKEN in your environment before starting the bot.")
    if not DATABASE_URL:
        raise SystemExit(
            "Set DATABASE_URL, TIGERDATA_DATABASE_URL, or "
            "AZURE_POSTGRESQL_CONNECTIONSTRING before starting the bot."
        )
    init_db()
    client.run(TOKEN)
