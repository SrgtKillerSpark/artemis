import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { createDeck, handValue, renderHand, isBlackjack, type Card } from '../../games/blackjack.js';
import { getEconomy, processGamble, CURRENCY, CURRENCY_ICON, MIN_BET } from '../../services/economy.js';
import { createEmbed, errorEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('Play blackjack against the dealer')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(MIN_BET),
  );

function buildEmbed(
  playerCards: Card[],
  dealerCards: Card[],
  bet: number,
  hideDealer: boolean,
  footer?: string,
): EmbedBuilder {
  const pVal = handValue(playerCards);
  const dVal = hideDealer ? '?' : handValue(dealerCards);

  return createEmbed()
    .setTitle('Blackjack')
    .addFields(
      {
        name: `Your Hand (${pVal})`,
        value: renderHand(playerCards),
        inline: true,
      },
      {
        name: `Dealer (${dVal})`,
        value: renderHand(dealerCards, hideDealer),
        inline: true,
      },
    )
    .setFooter({ text: footer ?? `Bet: ${bet.toLocaleString()} ${CURRENCY}` });
}

const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary),
);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const bet = interaction.options.getInteger('bet', true);

  const eco = await getEconomy(interaction.user.id, interaction.guildId);
  if (eco.balance < bet) {
    await interaction.reply({ embeds: [errorEmbed(`You don't have enough ${CURRENCY}.`)], ephemeral: true });
    return;
  }

  const deck = createDeck();
  const playerCards: Card[] = [deck.pop()!, deck.pop()!];
  const dealerCards: Card[] = [deck.pop()!, deck.pop()!];

  // Natural blackjack check
  if (isBlackjack(playerCards)) {
    const multiplier = isBlackjack(dealerCards) ? 1 : 2.5;
    const result = await processGamble(interaction.user.id, interaction.guildId!, bet, multiplier);
    const net = Math.floor(bet * multiplier) - bet;
    const label = multiplier === 1 ? 'Both blackjack — push!' : `Blackjack! +${net.toLocaleString()} ${CURRENCY}`;
    const embed = buildEmbed(playerCards, dealerCards, bet, false, label)
      .setColor(multiplier > 1 ? 0x57f287 : 0xfee75c);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  const response = await interaction.reply({
    embeds: [buildEmbed(playerCards, dealerCards, bet, true)],
    components: [buttons],
  });

  const collector = response.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 60_000,
  });

  async function finishGame(dealerPlays: boolean) {
    if (dealerPlays) {
      while (handValue(dealerCards) < 17) {
        dealerCards.push(deck.pop()!);
      }
    }

    const pVal = handValue(playerCards);
    const dVal = handValue(dealerCards);
    let multiplier: number;
    let label: string;
    let color: number;

    if (pVal > 21) {
      multiplier = 0;
      label = 'Bust! You lose.';
      color = 0xed4245;
    } else if (dVal > 21) {
      multiplier = 2;
      label = `Dealer busts! +${bet.toLocaleString()} ${CURRENCY}`;
      color = 0x57f287;
    } else if (pVal > dVal) {
      multiplier = 2;
      label = `You win! +${bet.toLocaleString()} ${CURRENCY}`;
      color = 0x57f287;
    } else if (pVal === dVal) {
      multiplier = 1;
      label = 'Push! Bet returned.';
      color = 0xfee75c;
    } else {
      multiplier = 0;
      label = `Dealer wins. -${bet.toLocaleString()} ${CURRENCY}`;
      color = 0xed4245;
    }

    await processGamble(interaction.user.id, interaction.guildId!, bet, multiplier);
    return buildEmbed(playerCards, dealerCards, bet, false, label).setColor(color);
  }

  collector.on('collect', async (i) => {
    if (i.customId === 'bj_hit') {
      playerCards.push(deck.pop()!);

      if (handValue(playerCards) >= 21) {
        collector.stop('done');
        const embed = await finishGame(handValue(playerCards) === 21);
        await i.update({ embeds: [embed], components: [] });
        return;
      }

      await i.update({ embeds: [buildEmbed(playerCards, dealerCards, bet, true)], components: [buttons] });
    } else if (i.customId === 'bj_stand') {
      collector.stop('done');
      const embed = await finishGame(true);
      await i.update({ embeds: [embed], components: [] });
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      const embed = await finishGame(true);
      embed.setFooter({ text: 'Timed out — auto-stand' });
      await interaction.editReply({ embeds: [embed], components: [] });
    }
  });
}
