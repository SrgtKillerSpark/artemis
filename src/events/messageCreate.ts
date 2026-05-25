import { ChannelType, Events, Message } from 'discord.js';
import { processMessageXp, LEVEL_UP_SOUL_BONUS } from '../services/levels.js';
import { addBalance, CURRENCY } from '../services/economy.js';
import { getSettings } from '../services/guild-settings.js';
import { createEmbed } from '../utils/embed.js';
import { logger } from '../utils/logger.js';

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  if (message.author.bot || !message.guildId) return;

  try {
    const result = await processMessageXp(message.author.id, message.guildId);

    if (result?.leveledUp) {
      const bonus = result.newLevel * LEVEL_UP_SOUL_BONUS;
      await addBalance(message.author.id, message.guildId, bonus);

      const embed = createEmbed()
        .setTitle('Level Up!')
        .setDescription(
          `Congrats ${message.author}! You reached **Level ${result.newLevel}**!\n+**${bonus}** ${CURRENCY} bonus`,
        )
        .setThumbnail(message.author.displayAvatarURL());

      const settings = await getSettings(message.guildId);
      let target: typeof message.channel = message.channel;

      if (settings.levelUpChannel) {
        const ch = await message.client.channels.fetch(settings.levelUpChannel).catch(() => null);
        if (ch?.type === ChannelType.GuildText) target = ch;
      }

      if (!('send' in target)) return;
      await target.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.warn({ err: error }, 'Failed to process message XP');
  }
}
