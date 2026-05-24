import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getEconomy, processGamble, CURRENCY, CURRENCY_ICON, MIN_BET } from '../../services/economy.js';
import { errorEmbed, successEmbed, createEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('Flip a coin — heads or tails, double or nothing')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(MIN_BET),
  )
  .addStringOption((opt) =>
    opt
      .setName('side')
      .setDescription('Pick a side')
      .setRequired(true)
      .addChoices(
        { name: 'Heads', value: 'heads' },
        { name: 'Tails', value: 'tails' },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const bet = interaction.options.getInteger('bet', true);
  const pick = interaction.options.getString('side', true);

  const eco = await getEconomy(interaction.user.id, interaction.guildId);
  if (eco.balance < bet) {
    await interaction.reply({ embeds: [errorEmbed(`You don't have enough ${CURRENCY}.`)], ephemeral: true });
    return;
  }

  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = result === pick;
  const multiplier = won ? 2 : 0;

  await processGamble(interaction.user.id, interaction.guildId, bet, multiplier);

  if (won) {
    await interaction.reply({
      embeds: [
        successEmbed(
          `The coin landed **${result}**! You won **${bet.toLocaleString()} ${CURRENCY}**! ${CURRENCY_ICON}`,
        ),
      ],
    });
  } else {
    await interaction.reply({
      embeds: [
        createEmbed()
          .setColor(0xed4245)
          .setDescription(
            `The coin landed **${result}**. You lost **${bet.toLocaleString()} ${CURRENCY}**.`,
          ),
      ],
    });
  }
}
