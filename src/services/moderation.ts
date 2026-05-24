import { Client, TextChannel } from 'discord.js';
import { db } from '../db/index.js';
import { createEmbed } from '../utils/embed.js';
import { logger } from '../utils/logger.js';

interface ModActionInput {
  action: string;
  userId: string;
  modId: string;
  guildId: string;
  reason?: string;
  duration?: number;
}

/** Save a mod action to the database and post to the log channel if configured. */
export async function logModAction(client: Client, input: ModActionInput) {
  const record = await db.modAction.create({
    data: {
      action: input.action,
      userId: input.userId,
      modId: input.modId,
      guildId: input.guildId,
      reason: input.reason,
      duration: input.duration,
    },
  });

  try {
    const settings = await db.guildSettings.findUnique({
      where: { guildId: input.guildId },
    });

    if (settings?.logChannel) {
      const channel = client.channels.cache.get(settings.logChannel);
      if (channel?.isTextBased()) {
        const embed = createEmbed()
          .setTitle(`${input.action.toUpperCase()}`)
          .addFields(
            { name: 'User', value: `<@${input.userId}>`, inline: true },
            { name: 'Moderator', value: `<@${input.modId}>`, inline: true },
            { name: 'Reason', value: input.reason || 'No reason provided' },
          )
          .setFooter({ text: `Case #${record.id}` });

        await (channel as TextChannel).send({ embeds: [embed] });
      }
    }
  } catch (error) {
    logger.warn({ err: error }, 'Failed to send mod log message');
  }

  return record;
}

export async function addWarning(
  guildId: string,
  userId: string,
  modId: string,
  reason: string,
) {
  return db.warning.create({
    data: { guildId, userId, modId, reason },
  });
}

export async function getWarnings(guildId: string, userId: string) {
  return db.warning.findMany({
    where: { guildId, userId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
}
