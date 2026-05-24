import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { logModAction } from '../../services/moderation.js';
import { errorEmbed, successEmbed } from '../../utils/embed.js';
import { formatDuration, parseDuration } from '../../utils/duration.js';

const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000; // 28 days (Discord limit)

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Timeout a member')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Member to mute').setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('duration')
      .setDescription('How long (e.g. 30m, 2h, 7d)')
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('reason').setDescription('Reason for the mute'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const target = interaction.options.getMember('user') as GuildMember | null;
  const durationStr = interaction.options.getString('duration', true);
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
    return;
  }
  if (target.id === interaction.user.id) {
    await interaction.reply({ embeds: [errorEmbed("You can't mute yourself.")], ephemeral: true });
    return;
  }
  if (!target.moderatable) {
    await interaction.reply({
      embeds: [errorEmbed("I can't mute that user. They may have a higher role than me.")],
      ephemeral: true,
    });
    return;
  }

  const ms = parseDuration(durationStr);
  if (!ms) {
    await interaction.reply({
      embeds: [errorEmbed('Invalid duration. Use formats like `30m`, `2h`, or `7d`.')],
      ephemeral: true,
    });
    return;
  }
  if (ms > MAX_TIMEOUT) {
    await interaction.reply({
      embeds: [errorEmbed('Duration cannot exceed 28 days.')],
      ephemeral: true,
    });
    return;
  }

  await target.timeout(ms, reason);

  await logModAction(interaction.client, {
    action: 'mute',
    userId: target.id,
    modId: interaction.user.id,
    guildId: interaction.guildId,
    reason,
    duration: Math.round(ms / 60_000),
  });

  await interaction.reply({
    embeds: [
      successEmbed(
        `Muted **${target.user.username}** for **${formatDuration(ms)}**.\nReason: ${reason}`,
      ),
    ],
  });
}
