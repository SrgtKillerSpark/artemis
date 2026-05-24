import { REST, Routes } from 'discord.js';
import { env } from './config.js';
import { logger } from './utils/logger.js';

const rest = new REST().setToken(env.DISCORD_TOKEN);
await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: [] });
logger.info('Global commands cleared.');
