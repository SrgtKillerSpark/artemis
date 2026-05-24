import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('reactionrole')
  .setDescription('Create a role-selection panel with buttons')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((opt) =>
    opt
      .setName('channel')
      .setDescription('Channel to post the panel in')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('title').setDescription('Panel title').setRequired(true),
  )
  .addRoleOption((opt) =>
    opt.setName('role1').setDescription('First role').setRequired(true),
  )
  .addRoleOption((opt) =>
    opt.setName('role2').setDescription('Second role (optional)'),
  )
  .addRoleOption((opt) =>
    opt.setName('role3').setDescription('Third role (optional)'),
  )
  .addRoleOption((opt) =>
    opt.setName('role4').setDescription('Fourth role (optional)'),
  )
  .addRoleOption((opt) =>
    opt.setName('role5').setDescription('Fifth role (optional)'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;

  const channel = interaction.options.getChannel('channel', true) as TextChannel;
  const title = interaction.options.getString('title', true);

  const roles = [
    interaction.options.getRole('role1', true),
    interaction.options.getRole('role2'),
    interaction.options.getRole('role3'),
    interaction.options.getRole('role4'),
    interaction.options.getRole('role5'),
  ].filter(Boolean);

  // Verify the bot can manage these roles
  const botMember = interaction.guild!.members.me!;
  const unmanageable = roles.filter(
    (r) => r!.position >= botMember.roles.highest.position,
  );
  if (unmanageable.length > 0) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          `I can't manage these roles (they're above my highest role): ${unmanageable.map((r) => r!.name).join(', ')}`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const embed = createEmbed()
    .setTitle(title)
    .setDescription(
      roles.map((r) => `**${r!.name}** — Click the button below to toggle`).join('\n'),
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    roles.map((r) =>
      new ButtonBuilder()
        .setCustomId(`rr_${r!.id}`)
        .setLabel(r!.name)
        .setStyle(ButtonStyle.Primary),
    ),
  );

  await channel.send({ embeds: [embed], components: [row] });

  await interaction.reply({
    embeds: [successEmbed(`Reaction role panel posted in <#${channel.id}>`)],
    ephemeral: true,
  });
}
