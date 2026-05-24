import { Events, GuildMember, Interaction } from 'discord.js';
import { logger } from '../utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
  // ── Button interactions (reaction roles, etc.) ──
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('rr_')) {
      await handleReactionRole(interaction);
    }
    // Blackjack and other game buttons are handled by their own collectors
    return;
  }

  // ── Slash commands ──
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    logger.warn(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error({ err: error, command: interaction.commandName }, 'Command execution failed');

    const reply = {
      content: 'Something went wrong running that command.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

/** Toggle a role when a user clicks a reaction-role button. */
async function handleReactionRole(interaction: Interaction) {
  if (!interaction.isButton() || !interaction.guild) return;

  const roleId = interaction.customId.slice(3); // strip "rr_"
  const member = interaction.member as GuildMember;
  const role = interaction.guild.roles.cache.get(roleId);

  if (!role) {
    await interaction.reply({ content: 'That role no longer exists.', ephemeral: true });
    return;
  }

  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      await interaction.reply({ content: `Removed **${role.name}**`, ephemeral: true });
    } else {
      await member.roles.add(roleId);
      await interaction.reply({ content: `Added **${role.name}**`, ephemeral: true });
    }
  } catch (error) {
    logger.error({ err: error, roleId }, 'Failed to toggle reaction role');
    await interaction.reply({
      content: "I can't manage that role. It may be above my highest role.",
      ephemeral: true,
    });
  }
}
