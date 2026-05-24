/**
 * Parse a human-readable duration string into milliseconds.
 * Supports: 30m, 2h, 7d (minutes, hours, days).
 * Returns null if the format is invalid.
 */
export function parseDuration(input: string): number | null {
  const match = input.trim().match(/^(\d+)\s*(m|h|d)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  if (value <= 0) return null;

  switch (match[2].toLowerCase()) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

/** Format milliseconds into a readable string like "2 hours" or "30 minutes". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
