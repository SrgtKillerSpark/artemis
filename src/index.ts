import './types.js';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { env } from './config.js';
import { logger } from './utils/logger.js';
import { loadCommands } from './loaders/commands.js';
import { loadEvents } from './loaders/events.js';
import { startStreamPoller } from './services/stream-poller.js';
import { startPollCloser } from './services/polls.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

await loadCommands(client);
await loadEvents(client);

await client.login(env.DISCORD_TOKEN);

startStreamPoller(client);
startPollCloser(client);

process.on('unhandledRejection', (error) => {
  logger.error({ err: error }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception — shutting down');
  process.exit(1);
});
