import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { transferBalance, CURRENCY, CURRENCY_ICON } from '../../services/economy.js';
import { errorEmbed, successEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Send Souls to another user')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Who to pay').setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt.setName('amount').setDescription('Amount to send').setRequired(true).setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const target = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);

  if (target.id === interaction.user.id) {
    await interaction.reply({ embeds: [errorEmbed("You can't pay yourself.")], ephemeral: true });
    return;
  }
  if (target.bot) {
    await interaction.reply({ embeds: [errorEmbed("You can't pay a bot.")], ephemeral: true });
    return;
  }

  const result = await transferBalance(interaction.user.id, target.id, interaction.guildId, amount);

  if (!result) {
    await interaction.reply({
      embeds: [errorEmbed(`You don't have enough ${CURRENCY}.`)],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [
      successEmbed(
        `${CURRENCY_ICON} Sent **${amount.toLocaleString()} ${CURRENCY}** to **${target.username}**.`,
      ),
    ],
  });
}
