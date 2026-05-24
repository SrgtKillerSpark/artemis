import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getLeaderboard, CURRENCY, CURRENCY_ICON } from '../../services/economy.js';
import { createEmbed, infoEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('See the richest members in this server');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const entries = await getLeaderboard(interaction.guildId);

  if (entries.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Nobody has any Souls yet. Try `/daily` or `/work`!')],
    });
    return;
  }

  const medals = ['#1', '#2', '#3'];
  const lines = entries.map((e, i) => {
    const rank = medals[i] ?? `#${i + 1}`;
    return `**${rank}** <@${e.discordId}> — **${e.balance.toLocaleString()}** ${CURRENCY}`;
  });

  const embed = createEmbed()
    .setTitle(`${CURRENCY_ICON} ${CURRENCY} Leaderboard`)
    .setDescription(lines.join('\n'));

  await interaction.reply({ embeds: [embed] });
}
