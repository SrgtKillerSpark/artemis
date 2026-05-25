import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../db/index.js';
import {
  accountIdToSteam64,
  extractVanity,
  formatRank,
  getHeroById,
  getHeroByName,
  getHeroes,
  getMatchHistory,
  getMmrHistory,
  parseSteamInput,
  searchSteamPlayer,
  steam64ToAccountId,
} from '../../services/deadlock-api.js';
import {
  archetypeForHero,
  ARCHETYPE_DESCRIPTIONS,
  ARCHETYPE_LABELS,
  type HeroArchetype,
} from '../../services/deadlock-archetypes.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embed.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('deadlock')
  .setDescription('Deadlock player stats and hero info')
  .addSubcommand((sub) =>
    sub
      .setName('link')
      .setDescription('Link your Steam account so you can use the other commands')
      .addStringOption((o) =>
        o
          .setName('steam')
          .setDescription('Steam ID, profile URL, or username')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('unlink').setDescription('Remove your Steam link'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('profile')
      .setDescription("Show a player's Deadlock profile card")
      .addUserOption((o) =>
        o.setName('user').setDescription('User to look up (defaults to you)'),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('hero')
      .setDescription('Info about a Deadlock hero')
      .addStringOption((o) =>
        o
          .setName('name')
          .setDescription('Hero name (e.g. "Abrams", "Seven", "Vindicta")')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('lastmatch')
      .setDescription("Show a player's most recent match")
      .addUserOption((o) =>
        o.setName('user').setDescription('User to look up (defaults to you)'),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('recent')
      .setDescription("Show a player's recent matches (compact list)")
      .addUserOption((o) =>
        o.setName('user').setDescription('User to look up (defaults to you)'),
      )
      .addIntegerOption((o) =>
        o
          .setName('count')
          .setDescription('How many matches to show (1-10, default 5)')
          .setMinValue(1)
          .setMaxValue(10),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('streak')
      .setDescription("Show a player's current win or loss streak")
      .addUserOption((o) =>
        o.setName('user').setDescription('User to look up (defaults to you)'),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('random')
      .setDescription('Pick a random hero, optionally filtered by archetype')
      .addStringOption((o) =>
        o
          .setName('archetype')
          .setDescription('Filter by playstyle archetype')
          .addChoices(
            { name: 'Carry', value: 'carry' },
            { name: 'Tank', value: 'tank' },
            { name: 'Burst', value: 'burst' },
            { name: 'Support', value: 'support' },
            { name: 'Flex', value: 'flex' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('leaderboard')
      .setDescription('Top Deadlock players in this server (linked members only)')
      .addStringOption((o) =>
        o
          .setName('sort')
          .setDescription('How to rank players (default: winrate)')
          .addChoices(
            { name: 'Win rate', value: 'winrate' },
            { name: 'Total wins', value: 'wins' },
            { name: 'Matches played', value: 'matches' },
            { name: 'Most recently played', value: 'recent' },
          ),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'link') return handleLink(interaction);
  if (sub === 'unlink') return handleUnlink(interaction);
  if (sub === 'profile') return handleProfile(interaction);
  if (sub === 'hero') return handleHero(interaction);
  if (sub === 'lastmatch') return handleLastMatch(interaction);
  if (sub === 'recent') return handleRecent(interaction);
  if (sub === 'streak') return handleStreak(interaction);
  if (sub === 'random') return handleRandom(interaction);
  if (sub === 'leaderboard') return handleLeaderboard(interaction);
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function getSteamIdForDiscord(discordId: string): Promise<string | null> {
  const row = await db.user.findUnique({ where: { discordId } });
  return row?.steamId ?? null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function notLinkedMessage(isSelf: boolean, targetName: string): string {
  return isSelf
    ? "You haven't linked your Steam yet. Use `/deadlock link` first."
    : `**${targetName}** hasn't linked their Steam account.`;
}

// ── Subcommands ───────────────────────────────────────────────────────────

async function handleLink(interaction: ChatInputCommandInteraction) {
  const input = interaction.options.getString('steam', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let steam64 = parseSteamInput(input);

  // If it wasn't a numeric ID or /profiles/ URL, try a Deadlock search
  if (!steam64) {
    const vanity = extractVanity(input);
    try {
      const results = await searchSteamPlayer(vanity);
      if (results.length === 0) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              `Couldn't find a Steam account matching **${input}**.\n\nTry one of:\n` +
                `• Your Steam64 ID (e.g. \`76561197960265728\`)\n` +
                `• Your profile URL: \`https://steamcommunity.com/profiles/...\`\n` +
                `• Your custom username (the part after \`/id/\` in your profile URL)\n\n` +
                `Note: the username search only finds players who've played Deadlock.`,
            ),
          ],
        });
        return;
      }
      steam64 = accountIdToSteam64(results[0].account_id);
    } catch (err) {
      logger.warn({ err, input }, 'Steam search failed');
      await interaction.editReply({
        embeds: [
          errorEmbed("Couldn't reach the Deadlock API. Try entering your Steam64 ID directly."),
        ],
      });
      return;
    }
  }

  await db.user.upsert({
    where: { discordId: interaction.user.id },
    create: { discordId: interaction.user.id, steamId: steam64 },
    update: { steamId: steam64 },
  });

  const accountId = steam64ToAccountId(steam64);
  await interaction.editReply({
    embeds: [
      successEmbed(
        `Linked your Steam: \`${steam64}\` (account_id \`${accountId}\`)\n\n` +
          `Try \`/deadlock profile\` or \`/deadlock lastmatch\`.`,
      ),
    ],
  });
}

async function handleUnlink(interaction: ChatInputCommandInteraction) {
  const existing = await db.user.findUnique({
    where: { discordId: interaction.user.id },
  });
  if (!existing?.steamId) {
    await interaction.reply({
      embeds: [errorEmbed("You don't have a Steam account linked.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await db.user.update({
    where: { discordId: interaction.user.id },
    data: { steamId: null },
  });

  await interaction.reply({
    embeds: [successEmbed('Your Steam link has been removed.')],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleProfile(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const steam64 = await getSteamIdForDiscord(target.id);

  if (!steam64) {
    await interaction.reply({
      embeds: [errorEmbed(notLinkedMessage(target.id === interaction.user.id, target.username))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();
  try {
    const accountId = steam64ToAccountId(steam64);
    const [matches, heroes, mmrHistory] = await Promise.all([
      getMatchHistory(accountId, 50),
      getHeroes(),
      getMmrHistory(accountId).catch(() => []),
    ]);

    if (matches.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed(`**${target.username}** has no Deadlock match history yet.`)],
      });
      return;
    }

    const heroById = new Map(heroes.map((h) => [h.id, h]));
    let wins = 0;
    let totalK = 0;
    let totalD = 0;
    let totalA = 0;
    let totalDuration = 0;
    const heroStats = new Map<number, { count: number; wins: number }>();

    for (const m of matches) {
      const isWin = m.match_result === m.player_team;
      if (isWin) wins++;
      totalK += m.player_kills;
      totalD += m.player_deaths;
      totalA += m.player_assists;
      totalDuration += m.match_duration_s;

      const hs = heroStats.get(m.hero_id) ?? { count: 0, wins: 0 };
      hs.count++;
      if (isWin) hs.wins++;
      heroStats.set(m.hero_id, hs);
    }

    const total = matches.length;
    const losses = total - wins;
    const winRate = Math.round((wins / total) * 100);
    const avgK = (totalK / total).toFixed(1);
    const avgD = (totalD / total).toFixed(1);
    const avgA = (totalA / total).toFixed(1);
    const kdaRatio = totalD > 0 ? ((totalK + totalA) / totalD).toFixed(2) : '∞';
    const avgDuration = formatDuration(Math.round(totalDuration / total));

    const topHeroLines = [...heroStats.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([heroId, hs]) => {
        const name = heroById.get(heroId)?.name ?? `Hero ${heroId}`;
        const hrWr = Math.round((hs.wins / hs.count) * 100);
        return `**${name}** — ${hs.count} matches · ${hs.wins}W/${hs.count - hs.wins}L · ${hrWr}%`;
      });

    // Latest rank (mmr-history is in chronological order, so last entry is current)
    const latestRank = mmrHistory.length > 0 ? mmrHistory[mmrHistory.length - 1] : undefined;
    const rankLabel = formatRank(latestRank);

    const embed = createEmbed()
      .setTitle(`${target.username}'s Deadlock Profile`)
      .setDescription(
        `**Rank:** ${rankLabel}\n` +
          `**Last ${total} matches:** ${wins}W / ${losses}L · **${winRate}%** win rate`,
      )
      .addFields(
        { name: 'Top Heroes', value: topHeroLines.join('\n') || '_none_', inline: false },
        {
          name: 'Avg KDA',
          value: `${avgK} / ${avgD} / ${avgA}\n(${kdaRatio} ratio)`,
          inline: true,
        },
        { name: 'Avg Match', value: avgDuration, inline: true },
      );

    // Use the most-played hero's icon as thumbnail
    const topHeroId = [...heroStats.entries()].sort((a, b) => b[1].count - a[1].count)[0]?.[0];
    const topHero = topHeroId !== undefined ? heroById.get(topHeroId) : undefined;
    const portrait = topHero?.images?.icon_hero_card ?? topHero?.images?.portrait;
    if (portrait) embed.setThumbnail(portrait);

    embed.setFooter({ text: `account_id: ${accountId}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err, steam64 }, 'Failed to fetch Deadlock profile');
    await interaction.editReply({
      embeds: [
        errorEmbed(
          "Couldn't fetch profile. The Deadlock API may be rate-limiting us, or this player has no public match history.",
        ),
      ],
    });
  }
}

async function handleHero(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true);
  await interaction.deferReply();

  try {
    const hero = await getHeroByName(name);
    if (!hero) {
      await interaction.editReply({
        embeds: [errorEmbed(`No hero matched "${name}". Try a different spelling.`)],
      });
      return;
    }

    const embed = createEmbed().setTitle(hero.name);

    const descBits: string[] = [];
    if (hero.description?.role) descBits.push(`**Role:** ${hero.description.role}`);
    if (hero.description?.playstyle)
      descBits.push(`**Playstyle:** ${hero.description.playstyle}`);
    if (hero.description?.lore) descBits.push(hero.description.lore);
    if (descBits.length > 0) embed.setDescription(descBits.join('\n\n'));

    const portrait =
      hero.images?.selection_image ?? hero.images?.portrait ?? hero.images?.icon_hero_card;
    if (portrait) embed.setThumbnail(portrait);

    embed.setFooter({ text: `Hero ID: ${hero.id}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err, name }, 'Failed to fetch hero');
    await interaction.editReply({
      embeds: [errorEmbed("Couldn't reach the Deadlock API. Try again in a moment.")],
    });
  }
}

async function handleLastMatch(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const steam64 = await getSteamIdForDiscord(target.id);

  if (!steam64) {
    await interaction.reply({
      embeds: [errorEmbed(notLinkedMessage(target.id === interaction.user.id, target.username))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();
  try {
    const accountId = steam64ToAccountId(steam64);
    const history = await getMatchHistory(accountId, 1);

    if (history.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed(`No matches found for **${target.username}**.`)],
      });
      return;
    }

    const match = history[0];
    const hero = await getHeroById(match.hero_id);
    const win = match.match_result === match.player_team;

    const embed = createEmbed()
      .setColor(win ? 0x57f287 : 0xed4245)
      .setTitle(`${win ? '🏆 Victory' : '💀 Defeat'} — ${hero?.name ?? `Hero ${match.hero_id}`}`)
      .setDescription(`<t:${match.start_time}:R> • <t:${match.start_time}:f>`)
      .addFields(
        {
          name: 'KDA',
          value: `${match.player_kills} / ${match.player_deaths} / ${match.player_assists}`,
          inline: true,
        },
        { name: 'Duration', value: formatDuration(match.match_duration_s), inline: true },
      );

    if (match.net_worth) {
      embed.addFields({
        name: 'Net Worth',
        value: `${match.net_worth.toLocaleString()} souls`,
        inline: true,
      });
    }
    if (typeof match.last_hits === 'number') {
      embed.addFields({
        name: 'Last Hits / Denies',
        value: `${match.last_hits} / ${match.denies ?? 0}`,
        inline: true,
      });
    }

    if (hero?.images?.icon_hero_card) embed.setThumbnail(hero.images.icon_hero_card);
    embed.setFooter({ text: `Match ID: ${match.match_id} • ${target.username}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err, steam64 }, 'Failed to fetch last match');
    await interaction.editReply({
      embeds: [
        errorEmbed(
          "Couldn't fetch the last match. The Deadlock API may be rate-limiting us " +
            '(without an API key, fresh match data has tight per-hour limits).',
        ),
      ],
    });
  }
}

async function handleRecent(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const count = interaction.options.getInteger('count') ?? 5;
  const steam64 = await getSteamIdForDiscord(target.id);

  if (!steam64) {
    await interaction.reply({
      embeds: [errorEmbed(notLinkedMessage(target.id === interaction.user.id, target.username))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();
  try {
    const accountId = steam64ToAccountId(steam64);
    const [matches, heroes] = await Promise.all([
      getMatchHistory(accountId, count),
      getHeroes(),
    ]);

    if (matches.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed(`No match history for **${target.username}**.`)],
      });
      return;
    }

    const heroById = new Map(heroes.map((h) => [h.id, h]));
    const lines = matches.map((m) => {
      const win = m.match_result === m.player_team;
      const indicator = win ? '🟢' : '🔴';
      const heroName = heroById.get(m.hero_id)?.name ?? `Hero ${m.hero_id}`;
      const kda = `${m.player_kills}/${m.player_deaths}/${m.player_assists}`;
      const duration = formatDuration(m.match_duration_s);
      return `${indicator} **${heroName}** · \`${kda}\` · ${duration} · <t:${m.start_time}:R>`;
    });

    const wins = matches.filter((m) => m.match_result === m.player_team).length;

    const embed = createEmbed()
      .setTitle(`${target.username}'s Recent Matches`)
      .setDescription(lines.join('\n'))
      .setFooter({
        text: `Last ${matches.length} matches · ${wins}W / ${matches.length - wins}L`,
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err, steam64 }, 'Failed to fetch recent matches');
    await interaction.editReply({
      embeds: [errorEmbed("Couldn't fetch recent matches. Try again in a bit.")],
    });
  }
}

async function handleStreak(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const steam64 = await getSteamIdForDiscord(target.id);

  if (!steam64) {
    await interaction.reply({
      embeds: [errorEmbed(notLinkedMessage(target.id === interaction.user.id, target.username))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();
  try {
    const accountId = steam64ToAccountId(steam64);
    // Pull enough matches to see the end of any reasonable streak
    const [matches, heroes] = await Promise.all([
      getMatchHistory(accountId, 30),
      getHeroes(),
    ]);

    if (matches.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed(`No match history for **${target.username}**.`)],
      });
      return;
    }

    const heroById = new Map(heroes.map((h) => [h.id, h]));

    // Determine the streak direction from the most recent match
    const firstWin = matches[0].match_result === matches[0].player_team;
    let streakLength = 0;
    for (const m of matches) {
      const isWin = m.match_result === m.player_team;
      if (isWin === firstWin) streakLength++;
      else break;
    }

    const streakMatches = matches.slice(0, streakLength);
    const breakerMatch = matches[streakLength]; // may be undefined if streak runs all 30

    const icon = firstWin ? '🔥' : '💀';
    const verb = firstWin ? 'WIN' : 'LOSS';
    const checkmark = firstWin ? '✅' : '❌';
    const color = firstWin ? 0x57f287 : 0xed4245;

    const matchLines = streakMatches.map((m, i) => {
      const heroName = heroById.get(m.hero_id)?.name ?? `Hero ${m.hero_id}`;
      const kda = `${m.player_kills}/${m.player_deaths}/${m.player_assists}`;
      return `${i + 1}. ${checkmark} **${heroName}** · \`${kda}\``;
    });

    let footer: string;
    if (breakerMatch) {
      const heroName =
        heroById.get(breakerMatch.hero_id)?.name ?? `Hero ${breakerMatch.hero_id}`;
      footer = `Last ${firstWin ? 'loss' : 'win'}: ${streakLength} game${streakLength === 1 ? '' : 's'} ago as ${heroName}`;
    } else {
      footer = `Streak goes back at least ${matches.length} matches`;
    }

    const embed = createEmbed()
      .setColor(color)
      .setTitle(
        `${icon} ${target.username} is on a ${streakLength}-game ${verb} streak`,
      )
      .setDescription(matchLines.join('\n'))
      .setFooter({ text: footer });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err, steam64 }, 'Failed to fetch streak');
    await interaction.editReply({
      embeds: [errorEmbed("Couldn't fetch streak data. Try again in a bit.")],
    });
  }
}

async function handleRandom(interaction: ChatInputCommandInteraction) {
  const archetypeFilter = interaction.options.getString('archetype') as
    | HeroArchetype
    | null;

  await interaction.deferReply();
  try {
    const heroes = await getHeroes();
    const selectable = heroes.filter(
      (h) => h.player_selectable !== false && !h.disabled,
    );

    const pool = archetypeFilter
      ? selectable.filter((h) => archetypeForHero(h.name) === archetypeFilter)
      : selectable;

    if (pool.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed(`No heroes match that archetype.`)],
      });
      return;
    }

    const hero = pool[Math.floor(Math.random() * pool.length)];
    const archetype = archetypeForHero(hero.name);
    const archetypeLabel = ARCHETYPE_LABELS[archetype];
    const archetypeDesc = ARCHETYPE_DESCRIPTIONS[archetype];

    const filterNote = archetypeFilter
      ? ` (filtered to **${archetypeLabel}**)`
      : '';

    const embed = createEmbed()
      .setTitle(`🎲 ${hero.name}`)
      .setDescription(
        `**Archetype:** ${archetypeLabel}\n*${archetypeDesc}*${filterNote}`,
      );

    const portrait =
      hero.images?.selection_image ??
      hero.images?.portrait ??
      hero.images?.icon_hero_card;
    if (portrait) embed.setImage(portrait);

    if (hero.description?.playstyle) {
      embed.addFields({ name: 'Playstyle', value: hero.description.playstyle });
    }

    embed.setFooter({ text: `Pool: ${pool.length} heroes · Pick again with /deadlock random` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err }, 'Failed to pick random hero');
    await interaction.editReply({
      embeds: [errorEmbed("Couldn't reach the Deadlock API for hero data.")],
    });
  }
}

interface LeaderboardRow {
  discordId: string;
  displayName: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  lastPlayed: number;
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) return;

  const sort = (interaction.options.getString('sort') ?? 'winrate') as
    | 'winrate'
    | 'wins'
    | 'matches'
    | 'recent';

  await interaction.deferReply();

  // Find linked users who are members of THIS guild
  await interaction.guild.members.fetch().catch(() => null);
  const memberIds = new Set(interaction.guild.members.cache.keys());

  const allLinked = await db.user.findMany({
    where: { steamId: { not: null } },
  });
  const guildLinked = allLinked.filter((u) => memberIds.has(u.discordId));

  if (guildLinked.length === 0) {
    await interaction.editReply({
      embeds: [
        errorEmbed(
          'No one in this server has linked their Steam yet. Use `/deadlock link` to start.',
        ),
      ],
    });
    return;
  }

  // Fetch match history for all linked users in parallel
  const results = await Promise.all(
    guildLinked.map(async (u): Promise<LeaderboardRow | null> => {
      try {
        const accountId = steam64ToAccountId(u.steamId!);
        const matches = await getMatchHistory(accountId, 20);
        if (matches.length < 5) return null; // need a minimum sample size

        const wins = matches.filter((m) => m.match_result === m.player_team).length;
        const total = matches.length;
        const lastPlayed = Math.max(...matches.map((m) => m.start_time));
        const member = interaction.guild!.members.cache.get(u.discordId);
        const displayName = member?.displayName ?? 'Unknown';

        return {
          discordId: u.discordId,
          displayName,
          wins,
          losses: total - wins,
          total,
          winRate: wins / total,
          lastPlayed,
        };
      } catch (err) {
        logger.debug({ err, discordId: u.discordId }, 'Skipping user in leaderboard');
        return null;
      }
    }),
  );

  const rows = results.filter((r): r is LeaderboardRow => r !== null);

  if (rows.length === 0) {
    await interaction.editReply({
      embeds: [
        errorEmbed(
          `${guildLinked.length} member${guildLinked.length === 1 ? '' : 's'} linked, but no one has at least 5 recent matches to rank. Play some games!`,
        ),
      ],
    });
    return;
  }

  rows.sort((a, b) => {
    if (sort === 'wins') return b.wins - a.wins;
    if (sort === 'matches') return b.total - a.total;
    if (sort === 'recent') return b.lastPlayed - a.lastPlayed;
    return b.winRate - a.winRate; // default
  });

  const top10 = rows.slice(0, 10);
  const lines = top10.map((r, i) => {
    const wr = Math.round(r.winRate * 100);
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
    return `${medal} **${r.displayName}** — ${wr}% WR (${r.wins}W/${r.losses}L)`;
  });

  const sortLabels: Record<string, string> = {
    winrate: 'win rate',
    wins: 'total wins',
    matches: 'matches played',
    recent: 'most recently played',
  };

  const embed = createEmbed()
    .setTitle('🏆 Server Deadlock Leaderboard')
    .setDescription(lines.join('\n'))
    .setFooter({
      text: `Sorted by ${sortLabels[sort]} · ${rows.length} of ${guildLinked.length} linked members qualify · last 20 matches each`,
    });

  await interaction.editReply({ embeds: [embed] });
}
