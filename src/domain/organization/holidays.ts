export function getHolidaySeedYears(referenceYear: number): number[] {
  return [
    ...new Set([
      referenceYear - 1,
      referenceYear,
      referenceYear + 1,
      referenceYear + 2,
      2026,
      2027,
      2028,
    ]),
  ].sort((a, b) => a - b);
}

export function isEstimatedHolidayRule(rule?: string): boolean {
  return /\b(?:hijri|islamic|muharram|safar|rabi|jumada|rajab|shaban|ramadan|shawwal|dhu al-qadah|dhu al-hijjah)\b/i.test(
    rule ?? '',
  );
}

type HolidayReference = {
  locationId: string;
  date: string;
  source: 'library' | 'company' | 'manual';
};

export function resolveEffectiveLocationHolidays<T extends HolidayReference>(
  rows: readonly T[],
): T[] {
  const key = (row: T) => JSON.stringify([row.locationId, row.date]);
  const overrides = new Set(
    rows.filter((row) => row.source !== 'library').map(key),
  );
  return rows.filter(
    (row) => row.source !== 'library' || !overrides.has(key(row)),
  );
}
