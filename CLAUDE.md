# Artemis Discord Bot

Multi-purpose Discord bot for The Motherboard community. Deadlock-focused with tournaments, Twitch integration, economy, and minigames.

## Quick Start

```bash
npm install
# Fill in .env (copy from .env.example)
npm run deploy-commands   # Register slash commands with Discord
npm run dev               # Start with hot reload
```

## Architecture

- TypeScript + discord.js v14 + Prisma + PostgreSQL
- Commands auto-loaded from `src/commands/` (supports subdirectories)
- Events auto-loaded from `src/events/`
- Each feature area gets its own command subdirectory and service

## Key Scripts

- `npm run dev` — Start with hot reload (tsx watch)
- `npm run build` — Compile TypeScript to dist/
- `npm run start` — Run compiled JS in production
- `npm run deploy-commands` — Push slash commands to Discord API
- `npm run db:push` — Push Prisma schema to database
- `npm run db:migrate` — Run database migrations

## Adding a Slash Command

1. Create a file in `src/commands/` exporting `data` (SlashCommandBuilder) and `execute` (handler)
2. Run `npm run deploy-commands`
3. If using `DISCORD_DEV_GUILD_ID` in .env, commands update instantly; otherwise takes up to 1 hour (global)

## Adding an Event Handler

Create a file in `src/events/` exporting `name` (Discord event name), `once` (boolean), and `execute` (handler).
