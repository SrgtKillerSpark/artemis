import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
} from 'discord.js';
import { getWarnings } from '../../services/moderation.js';
import { createEmbed, infoEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('View warnings for a member')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Member to check').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const target = interaction.options.getUser('user', true);

  const warnings = await getWarnings(interaction.guildId, target.id);

  if (warnings.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed(`**${target.username}** has no warnings.`)],
      ephemeral: true,
    });
    return;
  }

  const embed = createEmbed()
    .setTitle(`Warnings for ${target.username}`)
    .setThumbnail(target.displayAvatarURL())
    .setDescription(
      warnings
        .map(
          (w, i) =>
            `**#${i + 1}** — ${time(w.createdAt, 'R')}\nMod: <@${w.modId}>\nReason: ${w.reason}`,
        )
        .join('\n\n'),
    )
    .setFooter({ text: `${warnings.length} total warning(s)` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
