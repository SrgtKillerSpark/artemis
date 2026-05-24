# Discord Bot Project Plan

**Owner:** Andrew
**Status:** Planning
**Last updated:** May 20, 2026

---

## 1. Project Vision

A custom Discord bot that serves as the central hub for a Deadlock-focused community. Core pillars:

1. **Deadlock game integration** (stats, match lookups, leaderboards)
2. **Tournament hosting** (registration, brackets, scheduling, results)
3. **Twitch integration** (live notifications, stream roles, clip sharing)
4. **Deadlock Hub website integration** (shared accounts, data sync, two-way commands)
5. **Community engagement** (minigames, gambling, Pokemon-style drops, economy)
6. **General quality-of-life** (moderation, roles, welcome flows, logging)

The bot should be modular so features can be added/removed without breaking the rest.

---

## 2. Decisions to Make Before Coding

These are the foundational choices. The Code chat will need answers to all of these.

### 2.1 Language and Framework

| Option | Pros | Cons |
|---|---|---|
| **Node.js + discord.js (TypeScript)** | Most popular Discord lib, huge ecosystem, easy to share code with Deadlock Hub if it's also JS/TS, great async/await, strong typing with TS | More boilerplate than Python |
| Python + discord.py | Simple syntax, fast prototyping, lots of community bots to learn from | Type safety weaker, less natural fit if Hub is JS |
| Python + Pycord/Nextcord | Similar to discord.py, active forks with newer Discord features | Fragmentation in the Python Discord ecosystem |

**Recommendation:** TypeScript + discord.js v14+, especially if the Deadlock Hub is also TypeScript. Sharing types between bot and website is a huge win for the integration features.

**DECIDE:** _Language and library_

### 2.2 Hosting

| Option | Cost | Notes |
|---|---|---|
| VPS (Hetzner, DigitalOcean, Vultr) | $5 to $20/mo | Full control, SSH access, can run database on same box. Good default. |
| Railway / Fly.io / Render | Free tier to $10+/mo | Easy deploy from GitHub, less ops work |
| Raspberry Pi at home | One-time hardware cost | Good for learning, watch out for power/internet outages |
| AWS/GCP | Variable, can get pricey | Overkill for a personal bot unless you want to learn cloud |

**Recommendation:** Hetzner CX22 or DigitalOcean droplet ($4 to $7/mo). Plenty of headroom for a bot plus a small Postgres database.

**DECIDE:** _Hosting target_

### 2.3 Database

| Option | Use case |
|---|---|
| **PostgreSQL** | Recommended. Handles everything: users, economy, tournament state, match history. Same DB can be shared with the Hub website. |
| SQLite | Fine for early prototyping, but you'll outgrow it once tournaments and economy data scale up |
| MongoDB | Works but overkill, and relational data (tournaments, users, matches) fits SQL better |
| Redis | Add later as a cache and for ephemeral data (cooldowns, sessions, drop locations) |

**Recommendation:** PostgreSQL primary, Redis added in Phase 2 for caching and rate limiting.

**DECIDE:** _Database_

### 2.4 ORM / Query Layer (if going TS)

- **Prisma** (recommended): great DX, type-safe, auto-generates types from schema, easy migrations
- Drizzle: lighter, SQL-first, very fast
- Raw SQL with pg: maximum control, more boilerplate

### 2.5 Repo Structure

Single repo or multiple? Options:

- **Monorepo** (recommended): bot, website, and shared packages in one repo using pnpm workspaces or Turborepo. Shared types, single deploy pipeline.
- Separate repos: simpler mental model, more duplication

### 2.6 Bot Identity

- Bot name?
- Avatar/branding?
- Slash commands prefix or pure slash commands? (Pure slash is the modern standard, Discord pushes this hard now)

---

## 3. Existing Bot Recovery

Before building anything new, locate the old bot.

### 3.1 Checklist

- [ ] Log into [Discord Developer Portal](https://discord.com/developers/applications) with whatever Discord account you would have used
- [ ] Look for existing applications. If found, note: Application ID, Public Key, current bot token status
- [ ] Search old email for "Discord Developer Portal" or "application created"
- [ ] Search local machine for old bot repo (try: `bot`, `discord`, `.env`, `DISCORD_TOKEN`)
- [ ] Search GitHub/GitLab/Bitbucket for old bot repos
- [ ] Check 1Password/Bitwarden/browser password manager for any Discord-related entries

### 3.2 Decision Point

Once located:

- **Reuse the application** if the bot is already in servers you want to keep it in (preserves user IDs, message history references, etc.)
- **Start fresh** if the old setup is messy, you want a new name, or you can't recover the token

If reusing: regenerate the bot token (the old one might be compromised or you forgot it) and update OAuth scopes/intents for what we need now.

---

## 4. Phased Roadmap

### Phase 0: Foundation (Week 1)

Goal: a bot that's running, deployable, and ready to add features to.

- [ ] Repo set up with chosen language/framework
- [ ] Linting, formatting, TypeScript config (if TS)
- [ ] Environment variable management (.env, dotenv, secrets in production)
- [ ] Database connected, migrations system working
- [ ] Bot logs into Discord successfully
- [ ] Basic `/ping` slash command works
- [ ] Error handling middleware (don't crash on bad input)
- [ ] Logger (Pino or Winston for TS, structlog for Python)
- [ ] Deploy to chosen host, bot stays online 24/7
- [ ] Auto-restart on crash (PM2 or systemd)

### Phase 1: Core Infrastructure (Weeks 2 to 3)

Goal: shared systems that every feature will use.

- [ ] User registration/linking (Discord ID to internal user record)
- [ ] Permissions system (admin, mod, member, guest tiers)
- [ ] Server (guild) settings system (per-server configuration)
- [ ] Embed/message builder utilities (consistent look)
- [ ] Command help system (`/help`, autogenerated from command metadata)
- [ ] Audit log (who did what, when)
- [ ] Basic moderation: warn, mute, kick, ban (you'll want this early)

### Phase 2: Deadlock Integration (Weeks 3 to 5)

Goal: pull Deadlock data into Discord.

**Research first:** Deadlock is still in beta as of 2026 and Valve has not released an official public API. Check the current state of these community options:

- The Deadlock community has historically maintained reverse-engineered APIs and stats sites (assistant.deadlock-api.com, tracklock.gg, deadlock.blast.tv, etc.). Verify which are still active and have terms allowing third-party use.
- Steam Web API works for some basic profile data (Steam ID resolution, hours played)
- If you're building the Deadlock Hub website with its own scraper or data pipeline, the bot should probably read from YOUR database rather than hitting community APIs directly. This is cleaner and avoids rate limit issues.

Features once data source is settled:

- [ ] `/dl link <steam_id>` to link Discord account to Steam/Deadlock account
- [ ] `/dl stats [user]` to show MMR, win rate, recent matches, hero stats
- [ ] `/dl match <match_id>` to display match summary
- [ ] `/dl hero <hero_name>` for hero stats and tips
- [ ] `/dl leaderboard` for server-specific or global leaderboard
- [ ] Auto-post when linked users finish a notable match (big win, hero milestone)

### Phase 3: Tournament System (Weeks 5 to 8)

Goal: full tournament lifecycle in Discord, optionally synced with the Hub website.

- [ ] Tournament creation (`/tournament create` with prompts for format, size, prize, schedule)
- [ ] Registration (button-based, with check-in window)
- [ ] Team formation (solo signup with auto-team, or pre-made teams)
- [ ] Bracket generation (single elim, double elim, round robin, Swiss)
- [ ] Match assignment and reporting (`/match report <result>`)
- [ ] Admin override commands for disputes
- [ ] Auto-advancement when results submitted
- [ ] Bracket visualization (image generation or link to web view on the Hub)
- [ ] Tournament history and stats per player
- [ ] Notifications (DM players when their match is up, ping on no-show)

**Library suggestion:** for bracket logic, look at `tournament-pairings` (npm) or build custom. Don't use a heavy tournament platform unless you want to be a thin wrapper around it.

### Phase 4: Deadlock Hub Website Integration (Weeks 7 to 9, overlaps with 3)

Goal: bot and website share data and can trigger each other.

- [ ] Shared database OR REST/GraphQL API between them
- [ ] Discord OAuth on the Hub website (so users log in with Discord, accounts auto-link)
- [ ] Bot can query Hub data (user profiles, configured preferences)
- [ ] Hub can trigger bot actions (post announcements, create tournaments)
- [ ] Webhook handler in the bot for Hub-originated events
- [ ] Single sign-on feel: user identity is the same across both

### Phase 5: Twitch Integration (Weeks 9 to 10)

Goal: surface streams in Discord.

- [ ] Users link Twitch via OAuth (`/twitch link`)
- [ ] Auto-announce when linked streamers go live (configurable channel)
- [ ] "Now Live" role assignment while streaming
- [ ] Clip submission and voting (`/clip submit <url>`)
- [ ] Server can subscribe to specific external streamers (e.g., big Deadlock content creators) and get notifications
- [ ] Optional: chat bridge between Twitch chat and a Discord channel during streams

**Twitch API notes:** Use the EventSub WebSocket transport (the modern way), not the old webhook system. Helix API for queries. You'll need a Twitch app registered.

### Phase 6: Minigames and Economy (Weeks 10 to 12)

Goal: engagement features that make people open Discord daily.

- [ ] Currency system (server-local or global, your call)
- [ ] Daily/weekly rewards (`/daily`)
- [ ] Work/grind commands for earning currency
- [ ] Gambling games:
  - Coinflip
  - Blackjack (vs bot dealer)
  - Slots
  - Roulette
  - High/low cards
  - Crash (rising multiplier, cash out before crash)
  - Dice
- [ ] Leaderboards for richest users, biggest wins, etc.
- [ ] Anti-abuse: cooldowns, daily limits, suspicious-pattern detection
- [ ] Shop (spend currency on roles, custom commands, drops boost)

**Responsibility note:** Real gambling laws don't apply since no real money, but make the "currency has no real value" disclaimer visible. Don't let users trade currency for real items.

### Phase 7: Pokemon Drops (Weeks 12 to 14)

Goal: PokeMeow/Pokecord-style passive engagement.

- [ ] Random drops in active channels (Pokemon spawn based on chat activity)
- [ ] Catch via button/command
- [ ] Catch rates by rarity
- [ ] Inventory system (`/pokedex`)
- [ ] Trading between users
- [ ] Battling (PvE first, PvP later)
- [ ] Sprite assets (use existing public Pokemon sprite repos, but credit them)
- [ ] Special events (legendary spawns, themed weeks)

**Heads up on Pokemon IP:** Pokecord got shut down by Nintendo. Be aware of the risk. Alternatives:
- Use Pokemon but stay small and don't monetize (most likely fine, no guarantee)
- Reskin as "Deadlock heroes drops" or original creatures, tied to your community theme
- Use a non-Pokemon mon set (KindredMon, Kemono Friends-style, etc.)

---

## 5. Feature Backlog (Things to Add Later)

Things worth considering once the core is solid. Pick from these in priority order based on what your community wants.

### Community and Moderation
- Reaction roles (click emoji to get role)
- Level/XP system with rank cards
- Welcome and farewell messages with custom images
- Birthday tracking and announcements
- Custom commands (admins create their own)
- Server stats dashboard (members joined, messages per day, active channels)
- Ticket system for support requests
- Auto-mod (spam detection, slur filter, raid protection, link filter)
- Warning system with escalation
- Temporary roles (give role for X hours)
- Voice channel auto-creation ("join to create" pattern)
- Polls with timed results
- Quotes system (`/quote add`, random quote on `/quote`)
- Reminders (`/remindme 2h check the oven`)

### Deadlock-Specific Extras
- Match scheduler (find people to queue with at specific times)
- Coach finder (link coaches with players wanting lessons)
- Build sharing (post a build, others can copy)
- Patch note announcer (when Valve drops a patch)
- Hero rotation announcements
- Personal performance trends (am I improving on Vindicta this month?)
- Predictions: bet currency on pro match outcomes
- Trivia (Deadlock lore and mechanics)
- Replay link analyzer

### Content and Media
- Music bot (caveat: YouTube DMCA is brutal, Lavalink + a legal source is the path)
- Meme generator (image macros)
- AI chat integration (Claude API via Anthropic, OpenAI, etc.)
- Image generation
- Translation
- Weather lookup
- Wiki search (general or Deadlock-specific)

### Economy Expansion
- Player-to-player trading
- Auctions (timed listings)
- Pet system (currency feeds your pet, pet earns bonuses)
- Achievements/badges with rewards
- Daily challenges with bonus rewards
- Seasonal events with themed shops

### Power-User
- Bot uptime/health dashboard (web page or Discord channel)
- Backup/export commands for server admins
- Cross-server features (if you run multiple servers)
- API for third-party integrations
- Webhook receiver for arbitrary events

---

## 6. Tech Stack Summary (Recommended)

Filled in with my recommendations. Adjust based on your decisions in Section 2.

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Type safety, modern tooling, JS ecosystem |
| Discord lib | discord.js v14+ | Standard, well-maintained, huge community |
| Runtime | Node.js 20+ LTS | Stable, performant |
| Database | PostgreSQL 16 | Relational data fits, shareable with Hub |
| ORM | Prisma | Type-safe queries, easy migrations |
| Cache/Queue | Redis | Cooldowns, rate limits, job queue |
| Job runner | BullMQ | For scheduled drops, tournament timers, etc. |
| HTTP framework (for webhooks) | Fastify or Hono | Fast, lightweight |
| Logger | Pino | Fast structured logging |
| Process manager | PM2 or systemd | Keeps bot alive |
| Hosting | Hetzner or DigitalOcean VPS | Cheap, full control |
| CI/CD | GitHub Actions | Auto-deploy on push to main |
| Monorepo tool | pnpm workspaces or Turborepo | If sharing code with Hub |
| Secret management | dotenv-vault or 1Password CLI | Don't commit .env |
| Error tracking | Sentry (free tier) | Catch crashes in prod |

---

## 7. Suggested Repo Layout (TypeScript, single-repo bot)

```
deadlock-bot/
  src/
    commands/          # one file per slash command, auto-loaded
      deadlock/
      tournament/
      twitch/
      economy/
      pokemon/
      mod/
      util/
    events/            # Discord event handlers (ready, interactionCreate, etc.)
    services/          # business logic (TournamentService, DeadlockService, etc.)
    db/                # Prisma schema and client
    integrations/      # external API clients (Twitch, Deadlock APIs, Hub)
    jobs/              # scheduled/background jobs
    utils/             # shared helpers
    config.ts          # env loading and validation (zod)
    index.ts           # entry point
  prisma/
    schema.prisma
    migrations/
  tests/
  .env.example
  package.json
  tsconfig.json
  README.md
```

---

## 8. Environment Variables Needed

The Code chat will set these up. Listed here so nothing is forgotten.

```
# Discord
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_PUBLIC_KEY=
DISCORD_DEV_GUILD_ID=   # for fast slash command registration during dev

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://localhost:6379

# Twitch
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=

# Steam (for Deadlock account linking)
STEAM_API_KEY=

# Deadlock community APIs (if applicable)
DEADLOCK_API_KEY=

# Deadlock Hub website
HUB_API_URL=
HUB_API_KEY=

# Misc
NODE_ENV=development
LOG_LEVEL=info
SENTRY_DSN=
```

---

## 9. Key Risks and Open Questions

Things to think about before deep coding.

1. **Deadlock API legality and stability.** Community APIs can disappear or change. Plan to abstract this behind a service interface so swapping data sources is one-file change.
2. **Pokemon IP risk.** See Phase 7 notes. Recommend a reskin or a non-Pokemon set unless you accept the risk.
3. **Scope creep.** This plan has 15+ feature areas. Resist building everything before Phase 0 to 2 are rock solid. A bot that does 3 things perfectly beats one that does 15 things badly.
4. **Hosting reliability.** A Discord bot needs to stay online. Plan for: auto-restart, monitoring (UptimeRobot is free), and quick redeploy on outage.
5. **Bot token security.** If the token leaks, anyone can take over the bot. Use environment variables, never commit to git, rotate if you suspect a leak.
6. **Privacy.** Storing Discord user data triggers GDPR considerations if you have EU users. Have a data deletion command (`/account delete`) and a privacy policy.
7. **Rate limits.** Discord has per-route and global rate limits. discord.js handles most of this, but background loops that send many messages can trip them. Use queueing for bulk operations.

---

## 10. Handoff Notes for Code Chat

When taking this to a Code chat, give it:

1. This document (the full plan)
2. Your decisions from Section 2 (language, hosting, DB, name, repo structure)
3. The status of the existing bot (recovered? regenerated token? starting fresh?)
4. Whether the Deadlock Hub website is also being built in TypeScript (affects monorepo decision)
5. Your skill level so it knows how much to explain vs just write

Suggested first ask in the Code chat:

> "Here's my project plan (attached). I've decided on [language], [hosting], [DB], and the bot will be named [name]. The Hub website is in [stack]. I want to start with Phase 0: get the bot scaffolded, running locally, connecting to Discord, with a working /ping command and Prisma set up. Walk me through it."

Then do one phase at a time. Don't try to build it all in one Code chat session.

---

## 11. Living Document Notes

This plan should evolve. After each phase:

- Mark completed checkboxes
- Note what changed from the original plan
- Add new backlog items that came up
- Update tech stack if you switched anything

Keep this file in the repo as `docs/PROJECT_PLAN.md` so it's always next to the code.
