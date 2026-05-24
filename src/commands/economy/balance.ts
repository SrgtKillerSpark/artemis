import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getEconomy, CURRENCY, CURRENCY_ICON } from '../../services/economy.js';
import { createEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your (or someone else\'s) balance')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('User to check (defaults to you)'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const target = interaction.options.getUser('user') ?? interaction.user;
  const eco = await getEconomy(target.id, interaction.guildId);

  const embed = createEmbed()
    .setTitle(`${CURRENCY_ICON} ${target.username}'s Balance`)
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: 'Wallet', value: `**${eco.balance.toLocaleString()}** ${CURRENCY}`, inline: true },
      { name: 'Bank', value: `**${eco.bank.toLocaleString()}** ${CURRENCY}`, inline: true },
      { name: 'Net Worth', value: `**${(eco.balance + eco.bank).toLocaleString()}** ${CURRENCY}`, inline: true },
    );

  await interaction.reply({ embeds: [embed] });
}
