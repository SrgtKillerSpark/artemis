import { ChatInputCommandInteraction, SlashCommandBuilder, time } from 'discord.js';
import { claimWork, CURRENCY, CURRENCY_ICON } from '../../services/economy.js';
import { errorEmbed, successEmbed } from '../../utils/embed.js';

const JOBS = [
  'escorted the Guardian across the map',
  'destroyed an enemy Shrine',
  'collected Soul Orbs from the jungle',
  'landed the final blow on the Rejuvenator',
  'cleared a camp of troopers',
  'delivered the Urn successfully',
  'sniped an enemy from across the lane',
  'repaired the base defenses',
  'completed a bounty contract',
  'farmed the Soul Urn route',
];

export const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('Do some work to earn Souls (30-minute cooldown)');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const result = await claimWork(interaction.user.id, interaction.guildId);

  if (!result.success) {
    await interaction.reply({
      embeds: [
        errorEmbed(`You're still tired! You can work again ${time(result.nextWork, 'R')}.`),
      ],
      ephemeral: true,
    });
    return;
  }

  const job = JOBS[Math.floor(Math.random() * JOBS.length)];

  await interaction.reply({
    embeds: [
      successEmbed(
        `${CURRENCY_ICON} You ${job} and earned **${result.amount.toLocaleString()} ${CURRENCY}**!\nNew balance: **${result.newBalance.toLocaleString()} ${CURRENCY}**`,
      ),
    ],
  });
}
