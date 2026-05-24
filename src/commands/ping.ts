import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check if Artemis is alive and show latency');

export async function execute(interaction: ChatInputCommandInteraction) {
  const latency = Date.now() - interaction.createdTimestamp;
  const wsLatency = interaction.client.ws.ping;
  await interaction.reply(
    `Pong! Latency: **${latency}ms** | WebSocket: **${wsLatency}ms**`,
  );
}
