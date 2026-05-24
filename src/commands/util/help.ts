import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List all available commands');

export async function execute(interaction: ChatInputCommandInteraction) {
  const commands = interaction.client.commands;

  const grouped: Record<string, string[]> = {};
  for (const [, cmd] of commands) {
    // Group by directory based on command category
    const line = `**/${cmd.data.name}** — ${cmd.data.description}`;
    const category = getCategory(cmd.data.name);
    (grouped[category] ??= []).push(line);
  }

  const embed = createEmbed()
    .setTitle('Artemis Commands')
    .setDescription('Here\'s everything I can do.');

  for (const [category, lines] of Object.entries(grouped).sort()) {
    embed.addFields({ name: category, value: lines.join('\n') });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

function getCategory(name: string): string {
  const modCommands = ['warn', 'warnings', 'mute', 'kick', 'ban'];
  const adminCommands = ['settings', 'reactionrole'];
  const economyCommands = ['balance', 'daily', 'work', 'pay', 'leaderboard'];
  const gamblingCommands = ['coinflip', 'slots', 'dice', 'blackjack'];
  const levelCommands = ['rank', 'levels'];
  const twitchCommands = ['twitch'];
  if (modCommands.includes(name)) return 'Moderation';
  if (adminCommands.includes(name)) return 'Admin';
  if (economyCommands.includes(name)) return 'Economy';
  if (gamblingCommands.includes(name)) return 'Gambling';
  if (levelCommands.includes(name)) return 'Leveling';
  if (twitchCommands.includes(name)) return 'Twitch';
  return 'General';
}
