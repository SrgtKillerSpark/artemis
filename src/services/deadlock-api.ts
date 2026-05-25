import { env } from '../config.js';

const STEAM64_BASE = 76561197960265728n;
const API_BASE = 'https://api.deadlock-api.com';
const ASSETS_BASE = 'https://assets.deadlock-api.com';

const HERO_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let heroCache: Hero[] | null = null;
let heroCacheAt = 0;

export interface SteamSearchResult {
  account_id: number;
  persona_name?: string;
  name?: string;
  avatar?: string;
}

export interface MatchHistoryEntry {
  match_id: number;
  hero_id: number;
  player_kills: number;
  player_deaths: number;
  player_assists: number;
  net_worth?: number;
  match_duration_s: number;
  match_result: number; // 1 = win, 0 = loss (for the player's team)
  player_team: number;
  start_time: number; // unix seconds
  last_hits?: number;
  denies?: number;
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
  const base = path.startsWith('/v2') ? ASSETS_BASE : API_BASE;
  const url = new URL(path, base);
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

async function dapiBuffer(path: string, params?: Record<string, string>): Promise<Buffer> {
  const res = await fetch(buildUrl(path, params), { headers: buildHeaders() });
  if (!res.ok) {
    throw new Error(`Deadlock API ${path} → ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ── Endpoints ─────────────────────────────────────────────────────────────

export async function searchSteamPlayer(query: string): Promise<SteamSearchResult[]> {
  const data = await dapiJson<SteamSearchResult[]>('/v1/players/steam-search', {
    search_query: query,
  });
  return data;
}

export async function getPlayerCardImage(accountId: string): Promise<Buffer> {
  return dapiBuffer(`/v1/players/${accountId}/card`);
}

export async function getMatchHistory(
  accountId: string,
  limit = 10,
): Promise<MatchHistoryEntry[]> {
  return dapiJson<MatchHistoryEntry[]>(`/v1/players/${accountId}/match-history`, {
    limit: String(limit),
  });
}

export async function getHeroes(): Promise<Hero[]> {
  if (heroCache && Date.now() - heroCacheAt < HERO_CACHE_TTL_MS) return heroCache;
  const heroes = await dapiJson<Hero[]>('/v2/heroes');
  heroCache = heroes;
  heroCacheAt = Date.now();
  return heroes;
}

export async function getHeroById(id: number): Promise<Hero | null> {
  const all = await getHeroes();
  return all.find((h) => h.id === id) ?? null;
}

export async function getHeroByName(name: string): Promise<Hero | null> {
  const normalized = name.trim().toLowerCase().replace(/^hero_/, '');

  // Try direct lookup first
  try {
    return await dapiJson<Hero>(
      `/v2/heroes/by-name/${encodeURIComponent(normalized)}`,
    );
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('404')) {
      // Real error — surface it
      throw err;
    }
  }

  // Fallback: case-insensitive scan through the cached list
  const all = await getHeroes();
  return (
    all.find((h) => h.name.toLowerCase() === normalized) ??
    all.find((h) => h.name.toLowerCase().includes(normalized)) ??
    null
  );
}
