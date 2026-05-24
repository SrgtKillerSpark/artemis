import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getEconomy, processGamble, CURRENCY, CURRENCY_ICON, MIN_BET } from '../../services/economy.js';
import { errorEmbed, createEmbed } from '../../utils/embed.js';

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('Roll two dice — 8+ wins double, 7 pushes, 6 or less loses')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(MIN_BET),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const bet = interaction.options.getInteger('bet', true);

  const eco = await getEconomy(interaction.user.id, interaction.guildId);
  if (eco.balance < bet) {
    await interaction.reply({ embeds: [errorEmbed(`You don't have enough ${CURRENCY}.`)], ephemeral: true });
    return;
  }

  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;

  let multiplier: number;
  let outcome: string;
  let color: number;

  if (total >= 8) {
    multiplier = 2;
    outcome = `You win! **+${bet.toLocaleString()} ${CURRENCY}**`;
    color = 0x57f287;
  } else if (total === 7) {
    multiplier = 1;
    outcome = `Push! Bet returned.`;
    color = 0xfee75c;
  } else {
    multiplier = 0;
    outcome = `You lose. **-${bet.toLocaleString()} ${CURRENCY}**`;
    color = 0xed4245;
  }

  const result = await processGamble(interaction.user.id, interaction.guildId, bet, multiplier);
  const newBal = result?.balance ?? eco.balance;

  const embed = createEmbed()
    .setTitle('Dice Roll')
    .setDescription(
      `${DIE_FACES[die1 - 1]} ${DIE_FACES[die2 - 1]}  =  **${total}**\n\n${outcome}`,
    )
    .setColor(color)
    .setFooter({ text: `Balance: ${newBal.toLocaleString()} ${CURRENCY}` });

  await interaction.reply({ embeds: [embed] });
}
