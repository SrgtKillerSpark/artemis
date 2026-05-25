import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getXpLeaderboard } from '../../services/levels.js';
import { createEmbed, infoEmbed } from '../../utils/embed.js';
import { db } from '../../db/index.js';

const PAGE_SIZE = 10;

export const data = new SlashCommandBuilder()
  .setName('levels')
  .setDescription('See the most active members by XP')
  .addIntegerOption((o) =>
    o.setName('page').setDescription('Page number').setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;

  const totalUsers = await db.userLevel.count({
    where: { guildId: interaction.guildId, xp: { gt: 0 } },
  });

  if (totalUsers === 0) {
    await interaction.reply({
      embeds: [infoEmbed('No one has earned XP yet. Just keep chatting!')],
    });
    return;
  }

  const totalPages = Math.ceil(totalUsers / PAGE_SIZE);
  let page = Math.min(interaction.options.getInteger('page') ?? 1, totalPages);

  async function buildPage(p: number) {
    const entries = await getXpLeaderboard(interaction.guildId!, PAGE_SIZE, (p - 1) * PAGE_SIZE);
    const lines = entries.map((e, i) => {
      const rank = `#${(p - 1) * PAGE_SIZE + i + 1}`;
      return `**${rank}** <@${e.discordId}> — Level **${e.level}** (${e.xp.toLocaleString()} XP)`;
    });

    const embed = createEmbed()
      .setTitle('XP Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${p} of ${totalPages} • ${totalUsers} members` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('levels_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(p <= 1),
      new ButtonBuilder()
        .setCustomId('levels_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(p >= totalPages),
    );

    return { embeds: [embed], components: totalPages > 1 ? [row] : [] };
  }

  await interaction.reply(await buildPage(page));

  if (totalPages <= 1) return;

  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      await btn.reply({ content: 'Use `/levels` to browse the leaderboard yourself.', flags: MessageFlags.Ephemeral });
      return;
    }
    page += btn.customId === 'levels_next' ? 1 : -1;
    page = Math.max(1, Math.min(page, totalPages));
    await btn.update(await buildPage(page));
  });

  collector.on('end', async () => {
    const final = await buildPage(page);
    await interaction.editReply({ ...final, components: [] }).catch(() => {});
  });
}
