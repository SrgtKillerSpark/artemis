import { db } from '../db/index.js';

export const CURRENCY = 'Souls';
export const CURRENCY_ICON = '\u{1F4B0}';

const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const WORK_MIN = 100;
const WORK_MAX = 500;
const WORK_COOLDOWN = 30 * 60 * 1000;
const MIN_BET = 10;

export { MIN_BET };

/** Get or create a user's economy record for a guild. */
export async function getEconomy(discordId: string, guildId: string) {
  return db.userEconomy.upsert({
    where: { discordId_guildId: { discordId, guildId } },
    create: { discordId, guildId },
    update: {},
  });
}

/** Add balance to a user (for rewards, not gambling). */
export async function addBalance(discordId: string, guildId: string, amount: number) {
  return db.userEconomy.upsert({
    where: { discordId_guildId: { discordId, guildId } },
    create: { discordId, guildId, balance: amount, totalEarned: amount },
    update: {
      balance: { increment: amount },
      totalEarned: { increment: amount },
    },
  });
}

/**
 * Process a gamble result atomically.
 * multiplier: 0 = lost, 1 = push, 2 = doubled, 2.5 = blackjack, etc.
 * Returns the updated record, or null if insufficient balance.
 */
export async function processGamble(
  discordId: string,
  guildId: string,
  bet: number,
  multiplier: number,
) {
  return db.$transaction(async (tx) => {
    const eco = await tx.userEconomy.upsert({
      where: { discordId_guildId: { discordId, guildId } },
      create: { discordId, guildId },
      update: {},
    });
    if (eco.balance < bet) return null;

    const payout = Math.floor(bet * multiplier);
    const net = payout - bet;

    return tx.userEconomy.update({
      where: { discordId_guildId: { discordId, guildId } },
      data: {
        balance: eco.balance + net,
        totalEarned: net > 0 ? eco.totalEarned + net : eco.totalEarned,
        totalLost: net < 0 ? eco.totalLost + Math.abs(net) : eco.totalLost,
      },
    });
  });
}

/** Transfer currency between two users atomically. */
export async function transferBalance(
  fromId: string,
  toId: string,
  guildId: string,
  amount: number,
) {
  return db.$transaction(async (tx) => {
    const from = await tx.userEconomy.upsert({
      where: { discordId_guildId: { discordId: fromId, guildId } },
      create: { discordId: fromId, guildId },
      update: {},
    });
    if (from.balance < amount) return null;

    await tx.userEconomy.update({
      where: { discordId_guildId: { discordId: fromId, guildId } },
      data: { balance: { decrement: amount } },
    });

    await tx.userEconomy.upsert({
      where: { discordId_guildId: { discordId: toId, guildId } },
      create: { discordId: toId, guildId, balance: amount },
      update: { balance: { increment: amount } },
    });

    return true;
  });
}

/** Claim the daily reward. Returns null with next available time if on cooldown. */
export async function claimDaily(discordId: string, guildId: string) {
  const eco = await getEconomy(discordId, guildId);
  if (eco.lastDaily) {
    const elapsed = Date.now() - eco.lastDaily.getTime();
    if (elapsed < DAILY_COOLDOWN) {
      return {
        success: false as const,
        nextDaily: new Date(eco.lastDaily.getTime() + DAILY_COOLDOWN),
      };
    }
  }

  await db.userEconomy.update({
    where: { discordId_guildId: { discordId, guildId } },
    data: {
      balance: { increment: DAILY_AMOUNT },
      totalEarned: { increment: DAILY_AMOUNT },
      lastDaily: new Date(),
    },
  });

  return { success: true as const, amount: DAILY_AMOUNT, newBalance: eco.balance + DAILY_AMOUNT };
}

/** Do "work" for currency. Returns null with next available time if on cooldown. */
export async function claimWork(discordId: string, guildId: string) {
  const eco = await getEconomy(discordId, guildId);
  if (eco.lastWork) {
    const elapsed = Date.now() - eco.lastWork.getTime();
    if (elapsed < WORK_COOLDOWN) {
      return {
        success: false as const,
        nextWork: new Date(eco.lastWork.getTime() + WORK_COOLDOWN),
      };
    }
  }

  const amount = Math.floor(Math.random() * (WORK_MAX - WORK_MIN + 1)) + WORK_MIN;

  await db.userEconomy.update({
    where: { discordId_guildId: { discordId, guildId } },
    data: {
      balance: { increment: amount },
      totalEarned: { increment: amount },
      lastWork: new Date(),
    },
  });

  return { success: true as const, amount, newBalance: eco.balance + amount };
}

/** Top balances in a guild. */
export async function getLeaderboard(guildId: string, limit = 10) {
  return db.userEconomy.findMany({
    where: { guildId },
    orderBy: { balance: 'desc' },
    take: limit,
  });
}
