const aliases: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'US/Central': 'America/Chicago',
};
const labels: Record<string, string> = {
  'Asia/Manila': 'PHT',
  'Asia/Kolkata': 'IST',
  'Asia/Tokyo': 'JST',
  'Asia/Singapore': 'SGT',
  UTC: 'UTC',
  'Etc/UTC': 'UTC',
  'Etc/GMT': 'UTC',
};
export function normalizeTimeZone(tz?: string | null): string {
  if (!tz?.trim()) return 'UTC';
  const zone = aliases[tz.trim()] ?? tz.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return 'UTC';
  }
}
function parts(date: Date, zone: string, options: Intl.DateTimeFormatOptions) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, ...options })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
}
export function formatLocalDate(date: Date, timeZone?: string): string {
  const p = parts(date, normalizeTimeZone(timeZone), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return `${p.year}/${p.month}/${p.day}`;
}
export function computeIsoCalendarWeek(
  year: number,
  month: number,
  day: number,
) {
  const d = new Date(Date.UTC(year, month - 1, day));
  const isoWeekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - isoWeekday);
  const isoYear = d.getUTCFullYear();
  const isoWeek = Math.ceil(
    ((d.getTime() - Date.UTC(isoYear, 0, 1)) / 86400000 + 1) / 7,
  );
  return {
    isoYear,
    isoWeek,
    isoWeekday,
    formatted: `CW${String(isoWeek).padStart(2, '0')}.${isoWeekday}`,
  };
}
export function resolveTimeZoneAbbreviation(
  date: Date,
  timeZone?: string,
): string {
  const zone = normalizeTimeZone(timeZone);
  return (
    Object.entries(labels).find(
      ([key]) => key.toLowerCase() === zone.toLowerCase(),
    )?.[1] ??
    (parts(date, zone, { timeZoneName: 'shortOffset' }).timeZoneName ?? 'GMT')
      .replace('GMT', 'UTC')
      .replace(/^UTC[+-]0(?::00)?$/, 'UTC')
  );
}
export function formatViewerClock(date: Date, timeZone?: string) {
  const zone = normalizeTimeZone(timeZone);
  const p = parts(date, zone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return {
    time: `${p.hour}${p.minute}h`,
    zone: resolveTimeZoneAbbreviation(date, zone),
  };
}
export function getTodayWidgetModel(
  date: Date,
  timeZone?: string,
  cadenceOverride = 'No active PI · No active Sprint',
) {
  const dateText = formatLocalDate(date, timeZone);
  const [y, m, d] = dateText.split('/').map(Number);
  const cwText = computeIsoCalendarWeek(y!, m!, d!).formatted;
  const clock = formatViewerClock(date, timeZone);
  return {
    dateText,
    cwText,
    piSprintText: cadenceOverride,
    clockTime: clock.time,
    clockZone: clock.zone,
  };
}

export function getServerTodayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
