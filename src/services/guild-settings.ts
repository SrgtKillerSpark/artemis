import { db } from '../db/index.js';

/** Get guild settings, creating a default row if none exists. */
export async function getSettings(guildId: string) {
  return db.guildSettings.upsert({
    where: { guildId },
    create: { guildId },
    update: {},
  });
}

/** Update guild settings (creates if not exists). */
export async function updateSettings(
  guildId: string,
  data: {
    logChannel?: string | null;
    welcomeChannel?: string | null;
    welcomeMessage?: string | null;
  },
) {
  return db.guildSettings.upsert({
    where: { guildId },
    create: { guildId, ...data },
    update: data,
  });
}
