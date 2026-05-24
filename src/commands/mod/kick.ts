import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { logModAction } from '../../services/moderation.js';
import { errorEmbed, successEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the server')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Member to kick').setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('reason').setDescription('Reason for the kick'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const target = interaction.options.getMember('user') as GuildMember | null;
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
    return;
  }
  if (target.id === interaction.user.id) {
    await interaction.reply({ embeds: [errorEmbed("You can't kick yourself.")], ephemeral: true });
    return;
  }
  if (!target.kickable) {
    await interaction.reply({
      embeds: [errorEmbed("I can't kick that user. They may have a higher role than me.")],
      ephemeral: true,
    });
    return;
  }

  try {
    await target.send(
      `You have been kicked from **${interaction.guild!.name}**. Reason: ${reason}`,
    );
  } catch {
    // DMs may be closed
  }

  await target.kick(reason);

  await logModAction(interaction.client, {
    action: 'kick',
    userId: target.id,
    modId: interaction.user.id,
    guildId: interaction.guildId,
    reason,
  });

  await interaction.reply({
    embeds: [successEmbed(`Kicked **${target.user.username}**.\nReason: ${reason}`)],
  });
}
