import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
} from 'discord.js';
import { db } from '../db/index.js';
import { createEmbed } from '../utils/embed.js';
import { logger } from '../utils/logger.js';

const POLL_NUMBER_EMOJIS = [
  '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣',
  '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
];

export interface PollData {
  id: number;
  question: string;
  options: string[];
  closesAt: Date | null;
  closed: boolean;
  multiChoice: boolean;
  authorId: string;
}

export interface PollResult {
  option: string;
  count: number;
  percentage: number;
}

export async function createPoll(args: {
  guildId: string;
  channelId: string;
  messageId: string;
  authorId: string;
  question: string;
  options: string[];
  closesAt: Date | null;
  multiChoice: boolean;
}) {
  return db.poll.create({
    data: {
      guildId: args.guildId,
      channelId: args.channelId,
      messageId: args.messageId,
      authorId: args.authorId,
      question: args.question,
      options: args.options,
      closesAt: args.closesAt,
      multiChoice: args.multiChoice,
    },
  });
}

/**
 * Toggle a user's vote on a poll option.
 * - If they've already voted for this exact option: remove that vote.
 * - Otherwise, add it (and for single-choice polls, remove their other votes first).
 */
export async function toggleVote(pollId: number, userId: string, optionIdx: number) {
  const poll = await db.poll.findUnique({ where: { id: pollId } });
  if (!poll || poll.closed) return;

  const existing = await db.pollVote.findUnique({
    where: { pollId_userId_optionIdx: { pollId, userId, optionIdx } },
  });

  if (existing) {
    await db.pollVote.delete({ where: { id: existing.id } });
    return;
  }

  if (!poll.multiChoice) {
    await db.pollVote.deleteMany({ where: { pollId, userId } });
  }

  await db.pollVote.create({ data: { pollId, userId, optionIdx } });
}

export async function getPollState(pollId: number): Promise<{
  poll: PollData;
  results: PollResult[];
  totalVotes: number;
} | null> {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: { votes: true },
  });
  if (!poll) return null;

  const options = poll.options as unknown as string[];

  const counts = new Map<number, number>();
  for (const vote of poll.votes) {
    counts.set(vote.optionIdx, (counts.get(vote.optionIdx) ?? 0) + 1);
  }

  // For multi-choice polls, total "voters" is distinct users; for single, equal to total votes.
  // For percentages we use total votes cast (sums to 100% in single-choice, can exceed in multi).
  const totalVotes = poll.votes.length;

  const results: PollResult[] = options.map((option, idx) => {
    const count = counts.get(idx) ?? 0;
    return {
      option,
      count,
      percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
    };
  });

  return {
    poll: {
      id: poll.id,
      question: poll.question,
      options,
      closesAt: poll.closesAt,
      closed: poll.closed,
      multiChoice: poll.multiChoice,
      authorId: poll.authorId,
    },
    results,
    totalVotes,
  };
}

export function renderPollEmbed(
  poll: PollData,
  results: PollResult[],
  totalVotes: number,
): EmbedBuilder {
  const lines: string[] = [];
  const barLen = 14;

  for (let i = 0; i < poll.options.length; i++) {
    const r = results[i];
    const filled = Math.round((r.percentage / 100) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
    const emoji = POLL_NUMBER_EMOJIS[i] ?? `[${i + 1}]`;
    lines.push(
      `${emoji} **${r.option}**\n\`${bar}\` ${r.count} (${r.percentage}%)`,
    );
  }

  let footer: string;
  if (poll.closed) {
    footer = 'Poll closed';
  } else if (poll.closesAt) {
    footer = `Closes <t:${Math.floor(poll.closesAt.getTime() / 1000)}:R>`;
  } else {
    footer = 'Open ended';
  }
  const multiNote = poll.multiChoice ? ' • Multi-choice' : '';
  const lockIcon = poll.closed ? '🔒 ' : '';

  return createEmbed()
    .setTitle(`📊 ${poll.question}`)
    .setDescription(lines.join('\n\n'))
    .setFooter({
      text: `${lockIcon}${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'} • ${footer}${multiNote}`,
    });
}

export function renderPollButtons(poll: PollData): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (let i = 0; i < poll.options.length; i++) {
    const button = new ButtonBuilder()
      .setCustomId(`poll_${poll.id}_${i}`)
      .setLabel(poll.options[i].substring(0, 80))
      .setEmoji(POLL_NUMBER_EMOJIS[i])
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(poll.closed);

    currentRow.addComponents(button);

    if (currentRow.components.length === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
  }

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

async function closePollAndUpdate(client: Client, pollId: number) {
  await db.poll.update({ where: { id: pollId }, data: { closed: true } });

  const state = await getPollState(pollId);
  if (!state) return;

  const dbPoll = await db.poll.findUnique({ where: { id: pollId } });
  if (!dbPoll) return;

  const channel = await client.channels.fetch(dbPoll.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const message = await channel.messages.fetch(dbPoll.messageId).catch(() => null);
  if (!message) return;

  await message.edit({
    embeds: [renderPollEmbed(state.poll, state.results, state.totalVotes)],
    components: renderPollButtons(state.poll),
  });
}

/** Background loop that closes polls past their `closesAt` time. */
export function startPollCloser(client: Client) {
  const tick = async () => {
    try {
      const expired = await db.poll.findMany({
        where: {
          closed: false,
          closesAt: { not: null, lte: new Date() },
        },
        select: { id: true },
      });

      for (const { id } of expired) {
        try {
          await closePollAndUpdate(client, id);
          logger.info({ pollId: id }, 'Auto-closed expired poll');
        } catch (e) {
          logger.warn({ err: e, pollId: id }, 'Failed to auto-close poll');
        }
      }
    } catch (e) {
      logger.warn({ err: e }, 'Poll closer tick failed');
    }
  };

  setInterval(tick, 60_000);
  setTimeout(tick, 5_000); // first run shortly after boot
  logger.info('Poll closer started (checks every 60s)');
}
