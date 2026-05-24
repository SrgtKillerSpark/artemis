import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { logModAction } from '../../services/moderation.js';
import { errorEmbed, successEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member from the server')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Member to ban').setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('reason').setDescription('Reason for the ban'),
  )
  .addIntegerOption((opt) =>
    opt
      .setName('purge')
      .setDescription('Days of messages to delete (0-7)')
      .setMinValue(0)
      .setMaxValue(7),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const target = interaction.options.getMember('user') as GuildMember | null;
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const purgeDays = interaction.options.getInteger('purge') ?? 0;

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
    return;
  }
  if (target.id === interaction.user.id) {
    await interaction.reply({ embeds: [errorEmbed("You can't ban yourself.")], ephemeral: true });
    return;
  }
  if (!target.bannable) {
    await interaction.reply({
      embeds: [errorEmbed("I can't ban that user. They may have a higher role than me.")],
      ephemeral: true,
    });
    return;
  }

  try {
    await target.send(
      `You have been banned from **${interaction.guild!.name}**. Reason: ${reason}`,
    );
  } catch {
    // DMs may be closed
  }

  await target.ban({ deleteMessageSeconds: purgeDays * 86_400, reason });

  await logModAction(interaction.client, {
    action: 'ban',
    userId: target.id,
    modId: interaction.user.id,
    guildId: interaction.guildId,
    reason,
  });

  await interaction.reply({
    embeds: [successEmbed(`Banned **${target.user.username}**.\nReason: ${reason}`)],
  });
}
