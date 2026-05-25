import { REST, Routes, ChannelType } from 'discord.js';
import { env } from './config.js';

const RECON_CAP = 500;

if (!env.DISCORD_DEV_GUILD_ID) {
  console.error('DISCORD_DEV_GUILD_ID required');
  process.exit(1);
}

const GUILD_ID = env.DISCORD_DEV_GUILD_ID;
const rest = new REST().setToken(env.DISCORD_TOKEN);

interface RawChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
}

interface ChannelInfo {
  name: string;
  type: string;
  count: number;
  capped: boolean;
  error?: string;
}

function fmtTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} hours`;
}

console.log(`\nFetching channel list for guild ${GUILD_ID}...`);
const allChannels = (await rest.get(Routes.guildChannels(GUILD_ID))) as RawChannel[];

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const textChannels = allChannels.filter((c) => TEXT_TYPES.includes(c.type));

console.log(
  `\nFound ${allChannels.length} total channels (${textChannels.length} text/announcement)\n`,
);
console.log(`Scanning each up to ${RECON_CAP} messages...\n`);

const results: ChannelInfo[] = [];
const startTime = Date.now();

for (const channel of textChannels) {
  let count = 0;
  let lastId: string | undefined;
  let capped = false;
  let error: string | undefined;

  try {
    while (count < RECON_CAP) {
      const params = new URLSearchParams({ limit: '100' });
      if (lastId) params.set('before', lastId);

      const messages = (await rest.get(Routes.channelMessages(channel.id), {
        query: params,
      })) as { id: string }[];

      if (messages.length === 0) break;
      count += messages.length;
      lastId = messages[messages.length - 1].id;
      if (messages.length < 100) break;
    }

    if (count >= RECON_CAP) capped = true;
  } catch (e) {
    error = e instanceof Error ? e.message.substring(0, 60) : String(e);
  }

  const typeLabel =
    channel.type === ChannelType.GuildText ? 'text' : 'announcement';
  results.push({ name: channel.name, type: typeLabel, count, capped, error });

  const display = error ? `(error: ${error})` : `${count}${capped ? '+' : ''} messages`;
  console.log(`  #${channel.name.padEnd(30)} ${display}`);
}

const elapsedSec = Math.round((Date.now() - startTime) / 1000);
console.log(`\nRecon completed in ${elapsedSec}s`);

// Summary
const counted = results.filter((r) => !r.error);
const errors = results.filter((r) => r.error);
const short = counted.filter((r) => !r.capped);
const long = counted.filter((r) => r.capped);
const shortTotal = short.reduce((s, c) => s + c.count, 0);

console.log('\n=== SUMMARY ===');
console.log(`Scanned: ${counted.length} channels (${errors.length} errors)`);
console.log(
  `Short (<${RECON_CAP} msgs, exact): ${short.length} channels, ${shortTotal.toLocaleString()} total messages`,
);
console.log(
  `Long (${RECON_CAP}+ msgs, unknown total): ${long.length} channels`,
);

if (long.length > 0) {
  console.log('\nLong channels (need full crawl to count):');
  for (const c of long) console.log(`  #${c.name}`);
}

if (errors.length > 0) {
  console.log('\nChannels with errors (likely missing permissions):');
  for (const c of errors) console.log(`  #${c.name}: ${c.error}`);
}

// Estimate full crawl time.
// At 5 req/sec, 100 msgs/req → 500 msgs/sec ceiling.
// Real-world ~200-400/sec accounting for varying rate limit buckets.
console.log('\n=== FULL CRAWL ESTIMATE ===');
const lowEstPerLong = 1_000;
const highEstPerLong = 30_000;
const lowEstTotal = shortTotal + long.length * lowEstPerLong;
const highEstTotal = shortTotal + long.length * highEstPerLong;
const lowSec = Math.ceil(lowEstTotal / 400);
const highSec = Math.ceil(highEstTotal / 400);

console.log(`Estimated total messages: ${lowEstTotal.toLocaleString()} – ${highEstTotal.toLocaleString()}`);
console.log(`Estimated crawl time:     ${fmtTime(lowSec)} – ${fmtTime(highSec)}`);
console.log('(Wide range because we don\'t yet know the size of long channels.)');
