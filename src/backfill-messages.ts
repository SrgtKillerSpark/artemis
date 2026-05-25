import { REST, Routes, ChannelType } from 'discord.js';
import { db } from './db/index.js';
import { env } from './config.js';

const GUILD_ID = env.DISCORD_DEV_GUILD_ID;
if (!GUILD_ID) {
  console.error('DISCORD_DEV_GUILD_ID required');
  process.exit(1);
}

const rest = new REST().setToken(env.DISCORD_TOKEN);

// Message types that count as "user sent this message" (default + reply).
// Excludes system messages (joins, pins, boost notifications, etc.) and
// slash command outputs.
const COUNTED_TYPES = new Set([0, 19]);

interface RawChannel {
  id: string;
  name: string;
  type: number;
}

interface RawMessage {
  id: string;
  type: number;
  author: {
    id: string;
    bot?: boolean;
    username?: string;
  };
}

function fmtTime(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}

console.log(`\nFetching channel list for guild ${GUILD_ID}...`);
const allChannels = (await rest.get(Routes.guildChannels(GUILD_ID))) as RawChannel[];

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const textChannels = allChannels.filter((c) => TEXT_TYPES.includes(c.type));

console.log(`Crawling ${textChannels.length} text/announcement channels (threads skipped).\n`);
console.log('This is REST-only — your live bot stays connected.\n');
console.log('Progress will appear as each channel finishes:\n');

// userId -> total human message count across all channels
const counts = new Map<string, number>();
// userId -> seen username (for reporting; last-seen wins)
const usernames = new Map<string, string>();

interface ChannelStat {
  name: string;
  raw: number;
  human: number;
  errored: boolean;
}
const channelStats: ChannelStat[] = [];

const overallStart = Date.now();

for (const channel of textChannels) {
  const channelStart = Date.now();
  let lastId: string | undefined;
  let raw = 0;
  let human = 0;
  let errored = false;

  while (true) {
    const params = new URLSearchParams({ limit: '100' });
    if (lastId) params.set('before', lastId);

    let messages: RawMessage[];
    try {
      messages = (await rest.get(Routes.channelMessages(channel.id), {
        query: params,
      })) as RawMessage[];
    } catch (e) {
      const msg = e instanceof Error ? e.message.substring(0, 60) : String(e);
      console.log(`  #${channel.name}: ERROR (${msg})`);
      errored = true;
      break;
    }

    if (messages.length === 0) break;

    raw += messages.length;
    for (const m of messages) {
      if (m.author.bot) continue;
      if (!COUNTED_TYPES.has(m.type)) continue;
      human++;
      counts.set(m.author.id, (counts.get(m.author.id) ?? 0) + 1);
      if (m.author.username) usernames.set(m.author.id, m.author.username);
    }

    lastId = messages[messages.length - 1].id;
    if (messages.length < 100) break;
  }

  const elapsed = fmtTime(Date.now() - channelStart);
  console.log(
    `  #${channel.name.padEnd(30)} ${human.toLocaleString()} human / ${raw.toLocaleString()} raw  (${elapsed})`,
  );
  channelStats.push({ name: channel.name, raw, human, errored });
}

const totalElapsed = Date.now() - overallStart;
const totalRaw = channelStats.reduce((s, c) => s + c.raw, 0);
const totalHuman = channelStats.reduce((s, c) => s + c.human, 0);

console.log(`\n=== CRAWL DONE in ${fmtTime(totalElapsed)} ===`);
console.log(`Total raw messages scanned: ${totalRaw.toLocaleString()}`);
console.log(`Total human messages:       ${totalHuman.toLocaleString()}`);
console.log(`Unique authors:             ${counts.size.toLocaleString()}`);

// Top 10 leaderboard preview
const top10 = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('\nTop 10 most active users:');
for (const [id, count] of top10) {
  const name = usernames.get(id) ?? '(unknown)';
  console.log(`  ${name.padEnd(25)} ${count.toLocaleString()} messages  (${id})`);
}

// Write to DB
console.log('\nWriting to database...');
const writeStart = Date.now();

// Count existing vs new to give a useful summary
const existingIds = new Set(
  (
    await db.userLevel.findMany({
      where: { guildId: GUILD_ID },
      select: { discordId: true },
    })
  ).map((r) => r.discordId),
);

let updated = 0;
let created = 0;
for (const [discordId, msgCount] of counts) {
  await db.userLevel.upsert({
    where: { discordId_guildId: { discordId, guildId: GUILD_ID } },
    create: { discordId, guildId: GUILD_ID, totalMessages: msgCount },
    update: { totalMessages: msgCount },
  });
  if (existingIds.has(discordId)) updated++;
  else created++;
}

console.log(`Wrote ${counts.size} rows in ${fmtTime(Date.now() - writeStart)}.`);
console.log(`  Updated: ${updated} existing users`);
console.log(`  Created: ${created} new users (chatted but weren't in MEE6 leaderboard)`);

await db.$disconnect();
console.log('\nDone.');
