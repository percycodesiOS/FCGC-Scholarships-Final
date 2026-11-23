/**
 * Pure Eastern Time deadline helpers (safe in both Cloudflare Workers and browser bundles).
 */

export function easternWallTimeToUtcMs(wallIso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wallIso.trim());
  if (!match) return null;
  const [, y, m, d, hh, mm] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;

  const wallUtcGuess = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  function offsetAt(utcMs: number): number {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
    );
    const renderedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return renderedAsUtc - utcMs;
  }

  const firstPass = wallUtcGuess - offsetAt(wallUtcGuess);
  const secondPass = wallUtcGuess - offsetAt(firstPass);
  return secondPass;
}

export function isDeadlinePassed(
  deadlineIso: string | null | undefined,
  autoCloseAtDeadline: boolean | undefined,
  nowMs = Date.now(),
): boolean {
  if (!autoCloseAtDeadline || !deadlineIso) return false;
  const cutoffMs = easternWallTimeToUtcMs(deadlineIso);
  if (cutoffMs === null) return false;
  return nowMs >= cutoffMs;
}

export function formatEasternDeadline(wallIso: string): string | null {
  const utcMs = easternWallTimeToUtcMs(wallIso);
  if (utcMs === null) return null;
  const date = new Date(utcMs);
  const dayPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(date);
  const hour = timeParts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = timeParts.find((p) => p.type === 'minute')?.value ?? '00';
  const dayPeriod =
    (timeParts.find((p) => p.type === 'dayPeriod')?.value ?? '').toLowerCase() === 'pm' ? 'p.m.' : 'a.m.';
  const tz = timeParts.find((p) => p.type === 'timeZoneName')?.value ?? 'ET';
  return `${dayPart} · ${hour}:${minute} ${dayPeriod} ${tz}`;
}
