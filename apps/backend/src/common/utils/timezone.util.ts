/**
 * Timezone-aware day math shared by merchant analytics and the staff
 * console. "Today" always means today at the counter (the business's IANA
 * zone), never UTC midnight.
 */

/** YYYY-MM-DD as seen in the given timezone. */
export function dayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function zoneOffsetMs(date: Date, timezone: string): number {
  const asUtc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const asZone = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return asZone.getTime() - asUtc.getTime();
}

/** Midnight in the given timezone, expressed as a UTC instant. */
export function startOfLocalDay(date: Date, timezone: string): Date {
  const key = dayKey(date, timezone);
  const offsetMs = zoneOffsetMs(date, timezone);
  return new Date(new Date(`${key}T00:00:00.000Z`).getTime() - offsetMs);
}
