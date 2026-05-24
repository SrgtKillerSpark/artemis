import { Client, ChannelType, TextChannel } from 'discord.js';
import { db } from '../db/index.js';
import { getStreams, isConfigured, type TwitchStream } from './twitch-api.js';
import { getSettings } from './guild-settings.js';
import { createEmbed } from '../utils/embed.js';
import { logger } from '../utils/logger.js';

const POLL_INTERVAL = 90_000; // 90 seconds
const STREAM_COLOR = 0x9146ff; // Twitch purple

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startStreamPoller(client: Client) {
  if (!isConfigured()) {
    logger.info('Twitch credentials not configured, stream poller disabled');
    return;
  }

  logger.info(`Stream poller started (every ${POLL_INTERVAL / 1000}s)`);
  pollTimer = setInterval(() => pollStreams(client), POLL_INTERVAL);

  // Run first check after a short delay to let the bot connect
  setTimeout(() => pollStreams(client), 10_000);
}

export function stopStreamPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollStreams(client: Client) {
  try {
    const streamers = await db.twitchStreamer.findMany();
    if (streamers.length === 0) return;

    const twitchIds = [...new Set(streamers.map((s) => s.twitchId))];
    const liveStreams = await getStreams(twitchIds);
    const liveMap = new Map<string, TwitchStream>();
    for (const stream of liveStreams) {
      liveMap.set(stream.user_id, stream);
    }

    // Group streamers by guild for efficient notification
    const byGuild = new Map<string, typeof streamers>();
    for (const s of streamers) {
      const list = byGuild.get(s.guildId) ?? [];
      list.push(s);
      byGuild.set(s.guildId, list);
    }

    for (const [guildId, guildStreamers] of byGuild) {
      const settings = await getSettings(guildId);
      if (!settings.streamChannel) continue;

      const channel = await client.channels.fetch(settings.streamChannel).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) continue;

      for (const streamer of guildStreamers) {
        const stream = liveMap.get(streamer.twitchId);

        if (stream && stream.type === 'live') {
          // Streamer is live — notify if we haven't already for this stream
          if (!streamer.isLive || streamer.lastStreamId !== stream.id) {
            await sendLiveNotification(channel, stream);
            await db.twitchStreamer.update({
              where: { id: streamer.id },
              data: {
                isLive: true,
                lastNotifiedAt: new Date(),
                lastStreamId: stream.id,
              },
            });
            logger.info(`${streamer.displayName} went live: ${stream.title}`);
          }
        } else if (streamer.isLive) {
          // Streamer went offline
          await db.twitchStreamer.update({
            where: { id: streamer.id },
            data: { isLive: false },
          });
          logger.info(`${streamer.displayName} went offline`);
        }
      }
    }
  } catch (error) {
    logger.warn({ err: error }, 'Stream poll error');
  }
}

async function sendLiveNotification(channel: TextChannel, stream: TwitchStream) {
  const thumbnail = stream.thumbnail_url
    .replace('{width}', '440')
    .replace('{height}', '248');

  const embed = createEmbed()
    .setColor(STREAM_COLOR)
    .setAuthor({
      name: `${stream.user_name} is now live on Twitch!`,
      url: `https://twitch.tv/${stream.user_login}`,
      iconURL: 'https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-70x70.png',
    })
    .setTitle(stream.title || 'Untitled Stream')
    .setURL(`https://twitch.tv/${stream.user_login}`)
    .setDescription(`Playing **${stream.game_name || 'Just Chatting'}**`)
    .setImage(thumbnail + `?t=${Date.now()}`)
    .addFields(
      { name: 'Viewers', value: stream.viewer_count.toLocaleString(), inline: true },
      { name: 'Started', value: `<t:${Math.floor(new Date(stream.started_at).getTime() / 1000)}:R>`, inline: true },
    );

  await channel.send({
    content: `**${stream.user_name}** is live! https://twitch.tv/${stream.user_login}`,
    embeds: [embed],
  });
}
