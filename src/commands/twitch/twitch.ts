import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../db/index.js';
import { getUser, isConfigured } from '../../services/twitch-api.js';
import { createEmbed, successEmbed, errorEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('twitch')
  .setDescription('Manage Twitch stream notifications')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add a Twitch channel to track')
      .addStringOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Twitch username (e.g. "shroud")')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Stop tracking a Twitch channel')
      .addStringOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Twitch username to remove')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all tracked Twitch channels'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;

  if (!isConfigured()) {
    await interaction.reply({
      embeds: [errorEmbed('Twitch integration is not configured. Ask an admin to set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.')],
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    await interaction.deferReply({ ephemeral: true });
    const login = interaction.options.getString('channel', true).toLowerCase().trim();

    const existing = await db.twitchStreamer.findUnique({
      where: { guildId_twitchLogin: { guildId: interaction.guildId, twitchLogin: login } },
    });
    if (existing) {
      await interaction.editReply({ embeds: [errorEmbed(`**${login}** is already being tracked.`)] });
      return;
    }

    const user = await getUser(login);
    if (!user) {
      await interaction.editReply({ embeds: [errorEmbed(`Twitch user **${login}** not found.`)] });
      return;
    }

    await db.twitchStreamer.create({
      data: {
        guildId: interaction.guildId,
        twitchLogin: user.login,
        twitchId: user.id,
        displayName: user.display_name,
        addedBy: interaction.user.id,
      },
    });

    const embed = successEmbed(`Now tracking **${user.display_name}** ([twitch.tv/${user.login}](https://twitch.tv/${user.login}))`)
      .setThumbnail(user.profile_image_url);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === 'remove') {
    const login = interaction.options.getString('channel', true).toLowerCase().trim();

    const deleted = await db.twitchStreamer.deleteMany({
      where: { guildId: interaction.guildId, twitchLogin: login },
    });

    if (deleted.count === 0) {
      await interaction.reply({
        embeds: [errorEmbed(`**${login}** is not being tracked.`)],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [successEmbed(`Stopped tracking **${login}**.`)],
      ephemeral: true,
    });
    return;
  }

  if (sub === 'list') {
    const streamers = await db.twitchStreamer.findMany({
      where: { guildId: interaction.guildId },
      orderBy: { displayName: 'asc' },
    });

    if (streamers.length === 0) {
      await interaction.reply({
        embeds: [createEmbed().setTitle('Tracked Streamers').setDescription('No streamers are being tracked. Use `/twitch add` to add one.')],
        ephemeral: true,
      });
      return;
    }

    const lines = streamers.map((s) => {
      const status = s.isLive ? '🔴 LIVE' : '⚫ Offline';
      return `${status} **${s.displayName}** — [twitch.tv/${s.twitchLogin}](https://twitch.tv/${s.twitchLogin})`;
    });

    const embed = createEmbed()
      .setTitle('Tracked Streamers')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${streamers.length} streamer(s) tracked` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
