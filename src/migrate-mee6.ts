import { db } from './db/index.js';
import { env } from './config.js';
import { logger } from './utils/logger.js';
import { totalXpForLevel } from './services/levels.js';
import { REST, Routes } from 'discord.js';

const GUILD_ID = env.DISCORD_DEV_GUILD_ID;
if (!GUILD_ID) {
  logger.error('DISCORD_DEV_GUILD_ID is required for migration');
  process.exit(1);
}

// 68 users with known Discord IDs (extracted from MEE6 leaderboard avatar URLs)
const knownUsers: [string, number][] = [
  ['194662294242721795', 49],
  ['198474147326590977', 31],
  ['689300208714121294', 30],
  ['514359452305195030', 28],
  ['145757756375171072', 28],
  ['459832555978489866', 23],
  ['153192560624533506', 21],
  ['200421059852238849', 19],
  ['747066831222734939', 18],
  ['297183779238445057', 17],
  ['751936392006860851', 17],
  ['625789704377335841', 17],
  ['307343201038106635', 16],
  ['428756996859101184', 16],
  ['369574779126022146', 16],
  ['318110210612920321', 13],
  ['397208538277085194', 12],
  ['322504586038607872', 11],
  ['147119159849910272', 10],
  ['327606356452573185', 9],
  ['752229612712493138', 8],
  ['307794493284024320', 7],
  ['259161804654116864', 7],
  ['298626660029300737', 7],
  ['393229651822116865', 7],
  ['215997926944538624', 6],
  ['612130956572098580', 6],
  ['681969281948581935', 6],
  ['761765320586952725', 6],
  ['257335510412951552', 5],
  ['167719311954149376', 5],
  ['106165985731411968', 5],
  ['229796836901257216', 5],
  ['86324480271450112', 5],
  ['230736668703850497', 5],
  ['546368217933676553', 4],
  ['762673188139303012', 4],
  ['123946753614413824', 4],
  ['683038592515571734', 4],
  ['667786751858835458', 4],
  ['976237195188899900', 4],
  ['353994798857977857', 4],
  ['189526271405850626', 4],
  ['145758079789563904', 4],
  ['379659159538499585', 4],
  ['148557179002159104', 4],
  ['209761211133198337', 3],
  ['386731975571931136', 3],
  ['197345571172777984', 3],
  ['201143995269775363', 3],
  ['312962243551559682', 3],
  ['197256506276708352', 3],
  ['190571222965288960', 3],
  ['458040024567644161', 3],
  ['301688690747375616', 3],
  ['713487513452281917', 3],
  ['366265480404795403', 3],
  ['141682178344878080', 3],
  ['307922765883899905', 2],
  ['477397896476491787', 2],
  ['92708220463751168', 2],
  ['159785469452877824', 2],
  ['888262744267173980', 2],
  ['456022270423465984', 2],
  ['165653828476207104', 2],
  ['240264609477558292', 2],
  ['404090145768341504', 2],
  ['801100658660474881', 2],
];

// 32 users with only usernames (default Discord avatars, no ID in avatar URL)
const usernameOnly: [string, number][] = [
  ['Figment', 15],
  ['fuzziestwuzziest', 14],
  ['scythe.gg', 11],
  ['lexibird', 10],
  ['LukieOP', 7],
  ['OverLordBou', 7],
  ['ten10868', 5],
  ['aparagon', 5],
  ['Soyunamoto', 5],
  ['Djinky', 5],
  ['thequietone', 5],
  ['beholdensteak3', 4],
  ['richy86393', 4],
  ['WhiticanGG', 4],
  ['The Lone Shiba', 4],
  ['Kaitlin', 3],
  ['montybird9622', 3],
  ['DragonRager', 3],
  ['dot.sage', 3],
  ['Zestyy', 3],
  ['SummerPumpkin', 3],
  ['Echo', 3],
  ['Socks', 2],
  ['Level 1 crook', 2],
  ['kingbalrus', 2],
  ['powaaaahhhhh', 2],
  ['not_the_mango', 2],
  ['ChaosOracle46', 2],
  ['ragingrabbit', 2],
  ['miggsod', 2],
  ['dominickthegod', 2],
  ['abysw', 2],
];

async function upsertUser(discordId: string, level: number) {
  const xp = totalXpForLevel(level);
  await db.userLevel.upsert({
    where: { discordId_guildId: { discordId, guildId: GUILD_ID } },
    create: { discordId, guildId: GUILD_ID, xp, level },
    update: { xp, level },
  });
}

async function resolveUsername(rest: REST, username: string): Promise<string | null> {
  try {
    const members = (await rest.get(Routes.guildMembersSearch(GUILD_ID), {
      query: new URLSearchParams({ query: username, limit: '5' }),
    })) as Array<{ user: { id: string; username: string; global_name?: string } }>;

    const lower = username.toLowerCase();
    const match = members.find(
      (m) =>
        m.user.username.toLowerCase() === lower ||
        m.user.global_name?.toLowerCase() === lower,
    );
    return match?.user.id ?? null;
  } catch {
    return null;
  }
}

async function migrate() {
  logger.info(`Starting MEE6 migration for guild ${GUILD_ID}`);

  // Phase 1: Import 68 users with known Discord IDs
  let imported = 0;
  for (const [id, level] of knownUsers) {
    await upsertUser(id, level);
    imported++;
  }
  logger.info(`Phase 1 complete: ${imported} users with known IDs imported`);

  // Phase 2: Resolve 32 users by username via Discord API
  const rest = new REST().setToken(env.DISCORD_TOKEN);
  let resolved = 0;
  let unresolved: string[] = [];

  for (const [username, level] of usernameOnly) {
    const id = await resolveUsername(rest, username);
    if (id) {
      await upsertUser(id, level);
      resolved++;
      logger.info(`Resolved ${username} -> ${id} (level ${level})`);
    } else {
      unresolved.push(username);
      logger.warn(`Could not resolve username: ${username} (level ${level})`);
    }
  }

  logger.info(
    `Phase 2 complete: ${resolved} resolved, ${unresolved.length} unresolved`,
  );
  if (unresolved.length > 0) {
    logger.info({ unresolved }, 'Unresolved usernames (may have left the server or changed names)');
  }

  logger.info(`Migration complete: ${imported + resolved} of ${knownUsers.length + usernameOnly.length} users imported`);
}

await migrate();
await db.$disconnect();
