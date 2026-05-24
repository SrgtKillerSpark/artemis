import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getSettings, updateSettings } from '../../services/guild-settings.js';
import { createEmbed, successEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Configure Artemis for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub.setName('view').setDescription('View current settings'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('log-channel')
      .setDescription('Set the channel for mod action logs')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel for mod logs')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('level-channel')
      .setDescription('Set the channel for level-up announcements')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel for level-up messages')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('stream-channel')
      .setDescription('Set the channel for Twitch stream notifications')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel for stream notifications')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('welcome-channel')
      .setDescription('Set the welcome message channel')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel for welcome messages')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('welcome-message')
      .setDescription('Set the welcome message text ({user} = mention, {server} = server name)')
      .addStringOption((opt) =>
        opt.setName('message').setDescription('Welcome message template').setRequired(true),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;
  const sub = interaction.options.getSubcommand();

  if (sub === 'view') {
    const settings = await getSettings(interaction.guildId);
    const embed = createEmbed()
      .setTitle('Server Settings')
      .addFields(
        {
          name: 'Log Channel',
          value: settings.logChannel ? `<#${settings.logChannel}>` : 'Not set',
          inline: true,
        },
        {
          name: 'Level-Up Channel',
          value: settings.levelUpChannel ? `<#${settings.levelUpChannel}>` : 'Not set (posts in current channel)',
          inline: true,
        },
        {
          name: 'Stream Channel',
          value: settings.streamChannel ? `<#${settings.streamChannel}>` : 'Not set',
          inline: true,
        },
        {
          name: 'Welcome Channel',
          value: settings.welcomeChannel ? `<#${settings.welcomeChannel}>` : 'Not set',
          inline: true,
        },
        {
          name: 'Welcome Message',
          value: settings.welcomeMessage || 'Not set',
        },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (sub === 'log-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await updateSettings(interaction.guildId, { logChannel: channel.id });
    await interaction.reply({
      embeds: [successEmbed(`Mod log channel set to <#${channel.id}>`)],
      ephemeral: true,
    });
    return;
  }

  if (sub === 'level-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await updateSettings(interaction.guildId, { levelUpChannel: channel.id });
    await interaction.reply({
      embeds: [successEmbed(`Level-up announcements will be posted in <#${channel.id}>`)],
      ephemeral: true,
    });
    return;
  }

  if (sub === 'stream-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await updateSettings(interaction.guildId, { streamChannel: channel.id });
    await interaction.reply({
      embeds: [successEmbed(`Stream notifications will be posted in <#${channel.id}>`)],
      ephemeral: true,
    });
    return;
  }

  if (sub === 'welcome-channel') {
    const channel = interaction.options.getChannel('channel', true);
    await updateSettings(interaction.guildId, { welcomeChannel: channel.id });
    await interaction.reply({
      embeds: [successEmbed(`Welcome channel set to <#${channel.id}>`)],
      ephemeral: true,
    });
    return;
  }

  if (sub === 'welcome-message') {
    const message = interaction.options.getString('message', true);
    await updateSettings(interaction.guildId, { welcomeMessage: message });
    await interaction.reply({
      embeds: [successEmbed(`Welcome message updated:\n> ${message}`)],
      ephemeral: true,
    });
  }
}
