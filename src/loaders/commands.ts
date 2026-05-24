import { Client } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { logger } from '../utils/logger.js';
import type { Command } from '../types.js';

export async function loadCommands(client: Client) {
  const dir = join(fileURLToPath(import.meta.url), '..', '..', 'commands');
  const files = await readdir(dir, { recursive: true });

  for (const file of files) {
    if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

    const filePath = join(dir, file);
    try {
      const mod = (await import(pathToFileURL(filePath).href)) as Command;

      if (!mod.data || !mod.execute) {
        logger.warn(`Skipping ${file}: missing "data" or "execute" export`);
        continue;
      }

      client.commands.set(mod.data.name, mod);
      logger.debug(`Loaded command: ${mod.data.name}`);
    } catch (error) {
      logger.error({ err: error, file }, 'Failed to load command');
    }
  }

  logger.info(`Loaded ${client.commands.size} command(s)`);
}
