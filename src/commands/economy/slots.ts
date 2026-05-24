import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getEconomy, processGamble, CURRENCY, CURRENCY_ICON, MIN_BET } from '../../services/economy.js';
import { errorEmbed, createEmbed } from '../../utils/embed.js';

const SYMBOLS = [
  { emoji: '\u{1F352}', name: 'Cherry', weight: 30 },
  { emoji: '\u{1F34B}', name: 'Lemon', weight: 25 },
  { emoji: '\u{1F34A}', name: 'Orange', weight: 20 },
  { emoji: '\u{1F48E}', name: 'Diamond', weight: 15 },
  { emoji: '7️⃣', name: 'Seven', weight: 10 },
];

const PAYOUTS: Record<string, number> = {
  '7️⃣': 10,
  '\u{1F48E}': 5,
  '\u{1F34A}': 3,
  '\u{1F34B}': 2.5,
  '\u{1F352}': 2,
};
const TWO_MATCH_MULTIPLIER = 1.5;

function spin(): string {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.emoji;
  }
  return SYMBOLS[0].emoji;
}

export const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('Spin the slot machine')
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

  const reels = [spin(), spin(), spin()];
  const display = `> ${reels[0]}  ${reels[1]}  ${reels[2]}`;

  let multiplier = 0;
  let label = 'No match.';

  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    multiplier = PAYOUTS[reels[0]] ?? 2;
    label = `JACKPOT! **${multiplier}x**`;
  } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    multiplier = TWO_MATCH_MULTIPLIER;
    label = `Two match! **${TWO_MATCH_MULTIPLIER}x**`;
  }

  const result = await processGamble(interaction.user.id, interaction.guildId, bet, multiplier);
  const newBal = result?.balance ?? eco.balance - bet;
  const net = Math.floor(bet * multiplier) - bet;

  const embed = createEmbed()
    .setTitle('Slot Machine')
    .setDescription(
      `${display}\n\n${label}\n${net >= 0 ? `Won **+${net.toLocaleString()}** ${CURRENCY} ${CURRENCY_ICON}` : `Lost **${bet.toLocaleString()}** ${CURRENCY}`}`,
    )
    .setFooter({ text: `Balance: ${newBal.toLocaleString()} ${CURRENCY}` });

  embed.setColor(net >= 0 ? 0x57f287 : 0xed4245);

  await interaction.reply({ embeds: [embed] });
}
