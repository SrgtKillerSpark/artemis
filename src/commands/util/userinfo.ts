import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  time,
} from 'discord.js';
import { createEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Show info about a member')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Member to look up (defaults to you)'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const target = (interaction.options.getMember('user') ??
    interaction.member) as GuildMember;

  const roles = target.roles.cache
    .filter((r) => r.id !== interaction.guildId)
    .sort((a, b) => b.position - a.position)
    .map((r) => `${r}`)
    .join(', ');

  const embed = createEmbed()
    .setTitle(target.user.username)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'ID', value: target.id, inline: true },
      { name: 'Nickname', value: target.nickname ?? 'None', inline: true },
      {
        name: 'Account Created',
        value: time(target.user.createdAt, 'R'),
        inline: true,
      },
      {
        name: 'Joined Server',
        value: target.joinedAt ? time(target.joinedAt, 'R') : 'Unknown',
        inline: true,
      },
      {
        name: 'Highest Role',
        value: `${target.roles.highest}`,
        inline: true,
      },
      {
        name: `Roles (${target.roles.cache.size - 1})`,
        value: roles || 'None',
      },
    );

  await interaction.reply({ embeds: [embed] });
}
