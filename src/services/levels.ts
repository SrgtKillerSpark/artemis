import { db } from '../db/index.js';

const XP_PER_MESSAGE_MIN = 15;
const XP_PER_MESSAGE_MAX = 25;
const XP_COOLDOWN = 60_000; // 1 minute
const LEVEL_UP_SOUL_BONUS = 50; // Souls per level gained, multiplied by new level

// In-memory cooldown map (resets on restart, which is fine)
const cooldowns = new Map<string, number>();

/** XP required to go from level N to level N+1 (MEE6-style formula). */
export function xpForNextLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

/** Total cumulative XP required to reach a given level. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += xpForNextLevel(i);
  }
  return total;
}

/** What level does a given XP total correspond to? */
export function calculateLevel(xp: number): number {
  let level = 0;
  while (totalXpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

/** Build a progress bar string. */
export function progressBar(current: number, max: number, length = 16): string {
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

export { LEVEL_UP_SOUL_BONUS };

/**
 * Process a message for XP. Returns level-up info if the user leveled up,
 * or null if on cooldown / no level up.
 */
export async function processMessageXp(discordId: string, guildId: string) {
  const key = `${discordId}-${guildId}`;
  const now = Date.now();
  const last = cooldowns.get(key) ?? 0;

  if (now - last < XP_COOLDOWN) return null;
  cooldowns.set(key, now);

  const xpGained =
    Math.floor(Math.random() * (XP_PER_MESSAGE_MAX - XP_PER_MESSAGE_MIN + 1)) +
    XP_PER_MESSAGE_MIN;

  const record = await db.userLevel.upsert({
    where: { discordId_guildId: { discordId, guildId } },
    create: { discordId, guildId, xp: xpGained, totalMessages: 1, lastXpGain: new Date() },
    update: {
      xp: { increment: xpGained },
      totalMessages: { increment: 1 },
      lastXpGain: new Date(),
    },
  });

  const newLevel = calculateLevel(record.xp);

  if (newLevel > record.level) {
    await db.userLevel.update({
      where: { discordId_guildId: { discordId, guildId } },
      data: { level: newLevel },
    });
    return { leveledUp: true, newLevel, xp: record.xp };
  }

  return null;
}

/** Get a user's level record. */
export async function getLevelData(discordId: string, guildId: string) {
  return db.userLevel.upsert({
    where: { discordId_guildId: { discordId, guildId } },
    create: { discordId, guildId },
    update: {},
  });
}

/** Get the XP leaderboard for a guild. */
export async function getXpLeaderboard(guildId: string, limit = 10, offset = 0) {
  return db.userLevel.findMany({
    where: { guildId, xp: { gt: 0 } },
    orderBy: { xp: 'desc' },
    take: limit,
    skip: offset,
  });
}

/** Get a user's rank position in the guild. */
export async function getRank(discordId: string, guildId: string): Promise<number> {
  const user = await getLevelData(discordId, guildId);
  const higher = await db.userLevel.count({
    where: { guildId, xp: { gt: user.xp } },
  });
  return higher + 1;
}
