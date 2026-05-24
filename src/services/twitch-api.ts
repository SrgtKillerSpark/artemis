import { env } from '../config.js';
import { logger } from '../utils/logger.js';

let accessToken: string | null = null;
let tokenExpiresAt = 0;

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: 'live' | '';
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
}

export type { TwitchUser, TwitchStream };

async function getAppToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    throw new Error(`Twitch OAuth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  logger.info('Twitch app token acquired');
  return accessToken!;
}

async function twitchGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getAppToken();
  const url = new URL(`https://api.twitch.tv/helix/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    accessToken = null;
    return twitchGet(endpoint, params);
  }

  if (!res.ok) {
    throw new Error(`Twitch API ${endpoint}: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export async function getUser(login: string): Promise<TwitchUser | null> {
  const data = await twitchGet<{ data: TwitchUser[] }>('users', { login });
  return data.data[0] ?? null;
}

export async function getStreams(userIds: string[]): Promise<TwitchStream[]> {
  if (userIds.length === 0) return [];

  const allStreams: TwitchStream[] = [];

  // Twitch API allows up to 100 user_ids per request
  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    const url = new URL('https://api.twitch.tv/helix/streams');
    for (const id of batch) url.searchParams.append('user_id', id);
    url.searchParams.set('first', '100');

    const token = await getAppToken();
    const res = await fetch(url, {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      logger.warn(`Twitch streams API: ${res.status}`);
      continue;
    }

    const data = await res.json();
    allStreams.push(...data.data);
  }

  return allStreams;
}

export function isConfigured(): boolean {
  return Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
}
