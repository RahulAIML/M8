/** Sanfer programme start date — all data before this is pre-production testing */
export const DATA_EPOCH = '2026-06-01'

/** Returns the full date range from programme start to today */
export function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date().toISOString().split('T')[0]
  return { from: DATA_EPOCH, to }
}

/**
 * Resolves effective dates.
 * If both are null → falls back to DATA_EPOCH → today.
 */
export function resolveEffectiveDates(
  from: string | null,
  to: string | null,
): { from: string; to: string } {
  if (!from && !to) return getDefaultDateRange()
  const def = getDefaultDateRange()
  return {
    from: from ?? def.from,
    to:   to   ?? def.to,
  }
}

/** True when a YYYY-MM-DD string is within [from, to] inclusive */
export function inDateWindow(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}
