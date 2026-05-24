import { ChatInputCommandInteraction, SlashCommandBuilder, time } from 'discord.js';
import { claimDaily, CURRENCY, CURRENCY_ICON } from '../../services/economy.js';
import { errorEmbed, successEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily Souls reward');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const result = await claimDaily(interaction.user.id, interaction.guildId);

  if (!result.success) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          `You already claimed your daily! Come back ${time(result.nextDaily, 'R')}.`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [
      successEmbed(
        `${CURRENCY_ICON} You claimed **${result.amount.toLocaleString()} ${CURRENCY}**!\nNew balance: **${result.newBalance.toLocaleString()} ${CURRENCY}**`,
      ),
    ],
  });
}
