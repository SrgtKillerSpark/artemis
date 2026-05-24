import { REST, Routes } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { env } from './config.js';
import { logger } from './utils/logger.js';

const dir = join(fileURLToPath(import.meta.url), '..', 'commands');
const files = await readdir(dir, { recursive: true });

const commands: unknown[] = [];
for (const file of files) {
  if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;
  const mod = await import(pathToFileURL(join(dir, file)).href);
  if (mod.data) commands.push(mod.data.toJSON());
}

const rest = new REST().setToken(env.DISCORD_TOKEN);

if (env.DISCORD_DEV_GUILD_ID) {
  logger.info(`Deploying ${commands.length} command(s) to guild ${env.DISCORD_DEV_GUILD_ID}...`);
  await rest.put(
    Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_DEV_GUILD_ID),
    { body: commands },
  );
} else {
  logger.info(`Deploying ${commands.length} command(s) globally (may take up to 1 hour)...`);
  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: commands });
}

logger.info('Commands deployed successfully.');
