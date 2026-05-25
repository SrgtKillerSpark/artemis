import { Events, GuildMember, Interaction } from 'discord.js';
import {
  getPollState,
  renderPollButtons,
  renderPollEmbed,
  toggleVote,
} from '../services/polls.js';
import { logger } from '../utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
  // ── Button interactions (reaction roles, polls, etc.) ──
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('rr_')) {
      await handleReactionRole(interaction);
    } else if (interaction.customId.startsWith('poll_')) {
      await handlePollVote(interaction);
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

/** Record a vote when a user clicks a poll button, then refresh the poll message. */
async function handlePollVote(interaction: Interaction) {
  if (!interaction.isButton()) return;

  // customId is "poll_<pollId>_<optionIdx>"
  const parts = interaction.customId.split('_');
  const pollId = parseInt(parts[1], 10);
  const optionIdx = parseInt(parts[2], 10);
  if (Number.isNaN(pollId) || Number.isNaN(optionIdx)) return;

  try {
    await interaction.deferUpdate();
    await toggleVote(pollId, interaction.user.id, optionIdx);

    const state = await getPollState(pollId);
    if (!state) return;

    await interaction.editReply({
      embeds: [renderPollEmbed(state.poll, state.results, state.totalVotes)],
      components: renderPollButtons(state.poll),
    });
  } catch (error) {
    logger.error({ err: error, pollId, optionIdx }, 'Failed to handle poll vote');
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
