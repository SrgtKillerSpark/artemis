import { Client } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '../utils/logger.js';

interface EventModule {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => void;
}

export async function loadEvents(client: Client) {
  const dir = join(fileURLToPath(import.meta.url), '..', '..', 'events');
  const files = await readdir(dir);
  let count = 0;

  for (const file of files) {
    if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

    const filePath = join(dir, file);
    try {
      const event = (await import(pathToFileURL(filePath).href)) as EventModule;

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }

      logger.debug(`Loaded event: ${event.name}`);
      count++;
    } catch (error) {
      logger.error({ err: error, file }, 'Failed to load event');
    }
  }

  logger.info(`Loaded ${count} event(s)`);
}
