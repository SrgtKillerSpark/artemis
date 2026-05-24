import { Events, GuildMember, TextChannel } from 'discord.js';
import { getSettings } from '../services/guild-settings.js';
import { logger } from '../utils/logger.js';

export const name = Events.GuildMemberAdd;
export const once = false;

export async function execute(member: GuildMember) {
  try {
    const settings = await getSettings(member.guild.id);
    if (!settings.welcomeChannel || !settings.welcomeMessage) return;

    const channel = member.guild.channels.cache.get(settings.welcomeChannel);
    if (!channel?.isTextBased()) return;

    const message = settings.welcomeMessage
      .replace(/{user}/g, `${member}`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{membercount}/g, `${member.guild.memberCount}`);

    await (channel as TextChannel).send(message);
  } catch (error) {
    logger.warn({ err: error, guild: member.guild.id }, 'Failed to send welcome message');
  }
}
