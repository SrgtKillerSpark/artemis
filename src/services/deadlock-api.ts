import { env } from '../config.js';

const STEAM64_BASE = 76561197960265728n;
const API_BASE = 'https://api.deadlock-api.com';

const HERO_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let heroCache: Hero[] | null = null;
let heroCacheAt = 0;

const ITEM_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let itemCache: Item[] | null = null;
let itemCacheAt = 0;

export interface SteamSearchResult {
  account_id: number;
  persona_name?: string;
  name?: string;
  avatar?: string;
}

export interface MatchHistoryEntry {
  account_id: number;
  match_id: number;
  hero_id: number;
  hero_level?: number;
  player_kills: number;
  player_deaths: number;
  player_assists: number;
  net_worth?: number;
  match_duration_s: number;
  match_result: number; // The WINNING team index (0 or 1) — compare to player_team
  player_team: number; // 0 or 1
  start_time: number; // unix seconds
  last_hits?: number;
  denies?: number;
  team_abandoned?: boolean;
}

export type ItemSlot = 'weapon' | 'vitality' | 'spirit';

export interface Item {
  id: number;
  class_name: string;
  name: string;
  item_slot_type?: ItemSlot;
  item_tier?: number;
  cost?: number;
  shop_image?: string;
  shop_image_webp?: string;
  heroes?: number[];
  shopable?: boolean;
  is_active_item?: boolean;
  disabled?: boolean | null;
}

export interface MmrHistoryEntry {
  account_id: number;
  match_id: number;
  start_time: number;
  player_score: number;
  rank: number;
  division: number;
  division_tier: number;
}

export interface Hero {
  id: number;
  name: string;
  class_name?: string;
  player_selectable?: boolean;
  disabled?: boolean;
  images?: {
    icon_hero_card?: string;
    icon_image_small?: string;
    portrait?: string;
    minimap_image?: string;
    selection_image?: string;
    top_bar_image?: string;
  };
  description?: {
    lore?: string;
    role?: string;
    playstyle?: string;
  };
  starting_stats?: Record<string, { value?: number }>;
}

// ── ID helpers ────────────────────────────────────────────────────────────

export function steam64ToAccountId(steam64: string): string {
  return (BigInt(steam64) - STEAM64_BASE).toString();
}

export function accountIdToSteam64(accountId: string | number): string {
  return (BigInt(accountId) + STEAM64_BASE).toString();
}

/**
 * Parse common Steam ID inputs into a Steam64 string. Returns null if the
 * input isn't a numeric ID or profile URL (callers should fall back to a
 * vanity search).
 */
export function parseSteamInput(input: string): string | null {
  const t = input.trim();

  // Steam profile URL with numeric ID
  const profileMatch = t.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  // Bare Steam64 (17 digits starting with 7656)
  if (/^7656\d{13}$/.test(t)) return t;

  // Bare account_id / Steam32 — anything else numeric and <= 10 digits
  if (/^\d{1,10}$/.test(t)) return accountIdToSteam64(t);

  return null;
}

/** Extract the vanity name from a /id/ URL, or return the raw input for searching. */
export function extractVanity(input: string): string {
  const t = input.trim();
  const m = t.match(/steamcommunity\.com\/id\/([^/?\s]+)/);
  return m ? m[1] : t;
}

// ── Request helpers ───────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (env.DEADLOCK_API_KEY) headers['X-API-Key'] = env.DEADLOCK_API_KEY;
  return headers;
}

function buildUrl(path: string, params?: Record<string, string>): URL {
  const url = new URL(path, API_BASE);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

async function dapiJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const res = await fetch(buildUrl(path, params), { headers: buildHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Deadlock API ${path} → ${res.status} ${body.substring(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ── Endpoints ─────────────────────────────────────────────────────────────

/** Search for a Steam player by name. Returns empty array if none matched (404). */
export async function searchSteamPlayer(query: string): Promise<SteamSearchResult[]> {
  try {
    return await dapiJson<SteamSearchResult[]>('/v1/players/steam-search', {
      search_query: query,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('→ 404')) return [];
    throw err;
  }
}

export async function getMatchHistory(
  accountId: string,
  limit = 50,
): Promise<MatchHistoryEntry[]> {
  // The API currently ignores the `limit` query param and returns everything
  // it has cached. Slice client-side so callers always get the count they asked for.
  const matches = await dapiJson<MatchHistoryEntry[]>(
    `/v1/players/${accountId}/match-history`,
    { limit: String(limit) },
  );
  return matches.slice(0, limit);
}

export async function getMmrHistory(accountId: string): Promise<MmrHistoryEntry[]> {
  return dapiJson<MmrHistoryEntry[]>(`/v1/players/${accountId}/mmr-history`);
}

export async function getHeroes(): Promise<Hero[]> {
  if (heroCache && Date.now() - heroCacheAt < HERO_CACHE_TTL_MS) return heroCache;
  const heroes = await dapiJson<Hero[]>('/v1/assets/heroes');
  heroCache = heroes;
  heroCacheAt = Date.now();
  return heroes;
}

export async function getHeroById(id: number): Promise<Hero | null> {
  const all = await getHeroes();
  return all.find((h) => h.id === id) ?? null;
}

/** All items including abilities. Filter callers to shop items as needed. */
export async function getItems(): Promise<Item[]> {
  if (itemCache && Date.now() - itemCacheAt < ITEM_CACHE_TTL_MS) return itemCache;
  const items = await dapiJson<Item[]>('/v1/assets/items');
  itemCache = items;
  itemCacheAt = Date.now();
  return items;
}

/** Shop items only — buyable, no hero restriction, has a slot/tier. */
export async function getShopItems(): Promise<Item[]> {
  const all = await getItems();
  return all.filter(
    (i) =>
      i.item_slot_type !== undefined &&
      i.item_tier !== undefined &&
      i.disabled !== true &&
      (i.heroes?.length ?? 0) === 0,
  );
}

export async function getHeroByName(name: string): Promise<Hero | null> {
  const normalized = name.trim().toLowerCase().replace(/^hero_/, '');

  // Try direct lookup first
  try {
    return await dapiJson<Hero>(
      `/v1/assets/heroes/by-name/${encodeURIComponent(normalized)}`,
    );
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('→ 404')) throw err;
  }

  // Fallback: case-insensitive scan through the cached list
  const all = await getHeroes();
  return (
    all.find((h) => h.name.toLowerCase() === normalized) ??
    all.find((h) => h.name.toLowerCase().includes(normalized)) ??
    null
  );
}

// Deadlock rank tier names, indexed by `rank` from MMR history.
// Source: community wiki / in-game progression display.
const RANK_NAMES = [
  'Unranked', 'Initiate', 'Seeker', 'Alchemist', 'Arcanist',
  'Ritualist', 'Emissary', 'Archon', 'Oracle', 'Phantom',
  'Ascendant', 'Eternus',
];
const DIVISION_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export function formatRank(mmr: MmrHistoryEntry | undefined): string {
  if (!mmr || mmr.rank === 0) return 'Unranked';
  const tier = RANK_NAMES[mmr.rank] ?? `Rank ${mmr.rank}`;
  const division = DIVISION_ROMAN[mmr.division] ?? '';
  return division ? `${tier} ${division}` : tier;
}
