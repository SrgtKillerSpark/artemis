import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  createPoll,
  getPollState,
  renderPollEmbed,
  renderPollButtons,
} from '../../services/polls.js';
import { parseDuration } from '../../utils/duration.js';
import { errorEmbed } from '../../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Create a poll for the server to vote on')
  .addStringOption((o) =>
    o.setName('question').setDescription('The question to ask').setRequired(true).setMaxLength(200),
  )
  .addStringOption((o) =>
    o.setName('option1').setDescription('Option 1').setRequired(true).setMaxLength(80),
  )
  .addStringOption((o) =>
    o.setName('option2').setDescription('Option 2').setRequired(true).setMaxLength(80),
  )
  .addStringOption((o) => o.setName('option3').setDescription('Option 3').setMaxLength(80))
  .addStringOption((o) => o.setName('option4').setDescription('Option 4').setMaxLength(80))
  .addStringOption((o) => o.setName('option5').setDescription('Option 5').setMaxLength(80))
  .addStringOption((o) => o.setName('option6').setDescription('Option 6').setMaxLength(80))
  .addStringOption((o) => o.setName('option7').setDescription('Option 7').setMaxLength(80))
  .addStringOption((o) => o.setName('option8').setDescription('Option 8').setMaxLength(80))
  .addStringOption((o) => o.setName('option9').setDescription('Option 9').setMaxLength(80))
  .addStringOption((o) => o.setName('option10').setDescription('Option 10').setMaxLength(80))
  .addStringOption((o) =>
    o
      .setName('duration')
      .setDescription('How long the poll runs (e.g. "30m", "2h", "7d"). Default: open forever'),
  )
  .addBooleanOption((o) =>
    o.setName('multi').setDescription('Allow voting for multiple options (default: false)'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;

  const question = interaction.options.getString('question', true);
  const options: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const opt = interaction.options.getString(`option${i}`);
    if (opt) options.push(opt.trim());
  }

  if (options.length < 2) {
    await interaction.reply({
      embeds: [errorEmbed('A poll needs at least 2 options.')],
      ephemeral: true,
    });
    return;
  }

  const durationStr = interaction.options.getString('duration');
  let closesAt: Date | null = null;
  if (durationStr) {
    const ms = parseDuration(durationStr);
    if (!ms) {
      await interaction.reply({
        embeds: [
          errorEmbed(`Couldn't parse "${durationStr}". Try \`30m\`, \`2h\`, or \`7d\`.`),
        ],
        ephemeral: true,
      });
      return;
    }
    closesAt = new Date(Date.now() + ms);
  }

  const multiChoice = interaction.options.getBoolean('multi') ?? false;

  // Send placeholder so we can get a real message ID, then fill it in.
  await interaction.deferReply();
  const placeholder = await interaction.editReply({ content: 'Creating poll…' });

  const poll = await createPoll({
    guildId: interaction.guildId,
    channelId: placeholder.channelId,
    messageId: placeholder.id,
    authorId: interaction.user.id,
    question,
    options,
    closesAt,
    multiChoice,
  });

  const state = await getPollState(poll.id);
  if (!state) return; // shouldn't happen, just created it

  await interaction.editReply({
    content: '',
    embeds: [renderPollEmbed(state.poll, state.results, state.totalVotes)],
    components: renderPollButtons(state.poll),
  });
}
