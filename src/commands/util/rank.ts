import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import {
  getLevelData,
  getRank,
  totalXpForLevel,
  xpForNextLevel,
} from '../../services/levels.js';
import { generateRankCard } from '../../services/rank-card.js';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('View your (or someone else\'s) level and XP')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('User to check (defaults to you)'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;

  await interaction.deferReply();

  const target = (interaction.options.getMember('user') ??
    interaction.member) as GuildMember;

  const levelData = await getLevelData(target.id, interaction.guildId);
  const rank = await getRank(target.id, interaction.guildId);

  const currentLevelXp = totalXpForLevel(levelData.level);
  const nextLevelXp = xpForNextLevel(levelData.level);
  const xpIntoLevel = levelData.xp - currentLevelXp;

  const image = await generateRankCard({
    username: target.user.username,
    displayName: target.displayName,
    avatarUrl: target.displayAvatarURL({ size: 256, extension: 'png' }),
    level: levelData.level,
    rank,
    xpIntoLevel,
    xpNeeded: nextLevelXp,
    totalXp: levelData.xp,
    totalMessages: levelData.totalMessages,
  });

  const attachment = new AttachmentBuilder(image, { name: 'rank.png' });
  await interaction.editReply({ files: [attachment] });
}
