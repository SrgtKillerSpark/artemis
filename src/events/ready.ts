import { Client, Events } from 'discord.js';
import { logger } from '../utils/logger.js';

export const name = Events.ClientReady;
export const once = true;

export function execute(client: Client<true>) {
  logger.info(
    `Logged in as ${client.user.tag} | Serving ${client.guilds.cache.size} server(s)`,
  );
}
