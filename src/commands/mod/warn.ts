import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { addWarning, getWarnings, logModAction } from '../../services/moderation.js';
import { errorEmbed, successEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Issue a warning to a member')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Member to warn').setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('reason').setDescription('Reason for the warning').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);

  if (target.id === interaction.user.id) {
    await interaction.reply({ embeds: [errorEmbed("You can't warn yourself.")], ephemeral: true });
    return;
  }
  if (target.bot) {
    await interaction.reply({ embeds: [errorEmbed("You can't warn a bot.")], ephemeral: true });
    return;
  }

  await addWarning(interaction.guildId, target.id, interaction.user.id, reason);

  await logModAction(interaction.client, {
    action: 'warn',
    userId: target.id,
    modId: interaction.user.id,
    guildId: interaction.guildId,
    reason,
  });

  const allWarnings = await getWarnings(interaction.guildId, target.id);

  try {
    await target.send(
      `You have been warned in **${interaction.guild!.name}** for: ${reason}`,
    );
  } catch {
    // DMs may be closed
  }

  await interaction.reply({
    embeds: [
      successEmbed(
        `Warned **${target.username}** — they now have **${allWarnings.length}** warning(s).\nReason: ${reason}`,
      ),
    ],
  });
}
