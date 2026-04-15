import {
  eachDayOfInterval,
  isWeekend,
  parseISO,
  addDays,
  subDays,
  format,
} from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HolidayType = 'holiday' | 'makeup_work'

export interface HolidayEntry {
  name: string
  nameEn: string
  start: string
  end: string
  type: HolidayType
  is_official: boolean
}

export interface Strategy {
  id: string
  name: string
  year: number
  leaveDays: number
  totalDays: number
  cpValue: number | null       // null when isFreebie === true
  start: string
  end: string
  suggestedLeaveDates: string[]
  holidayDates: string[]
  weekendDates: string[]
  isFreebie: boolean
  isOfficial: boolean
  isSuperCombo: boolean
}

// ─── Slug Map ─────────────────────────────────────────────────────────────────

const SLUG_MAP: Record<string, string> = {
  '農曆新年': 'lunar-new-year',
  '和平紀念日': 'peace-memorial-day',
  '兒童節': 'childrens-day',
  '清明節': 'tomb-sweeping-day',
  '勞動節': 'labor-day',
  '端午節': 'dragon-boat-festival',
  '中秋節': 'mid-autumn-festival',
  '國慶日': 'national-day',
  '元旦': 'new-years-day',
}

export function slugify(name: string): string {
  // Strip suffixes like （補假）（補班）
  const base = name.replace(/（.*?）/g, '').trim()
  const fallback = base.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (process.env.NODE_ENV !== 'production' && !SLUG_MAP[base] && !fallback && base) {
    console.warn(`[slugify] No slug for: "${base}" — add to SLUG_MAP`)
  }
  return SLUG_MAP[base] ?? (fallback || `unknown-${Date.now()}`)
}

// ─── Core Helpers ─────────────────────────────────────────────────────────────

/**
 * Count how many days in [start, end] require actual leave.
 * A day requires leave if it is:
 *   - A weekday AND not in holidayDates, OR
 *   - A makeup workday (weekend designated as workday by government)
 */
export function calculateEffectiveLeave(
  start: Date,
  end: Date,
  holidayDates: Set<string>,
  makeupDates: Set<string>
): { leaveDays: number; suggestedLeaveDates: string[] } {
  const days = eachDayOfInterval({ start, end })
  const suggestedLeaveDates: string[] = []

  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd')
    if (makeupDates.has(dateStr)) {
      // Government-designated workday on a weekend → must request leave
      suggestedLeaveDates.push(dateStr)
    } else if (!isWeekend(day) && !holidayDates.has(dateStr)) {
      // Regular workday not covered by holiday
      suggestedLeaveDates.push(dateStr)
    }
  }

  return { leaveDays: suggestedLeaveDates.length, suggestedLeaveDates }
}

/**
 * Expand a date range outward to include adjacent weekends on both sides.
 * A Saturday input will absorb the following Sunday (and vice versa).
 * e.g. expandWeekends(Mon, Mon) → { start: Sat, end: Mon }
 *      expandWeekends(Fri, Fri) → { start: Fri, end: Sun }
 *      expandWeekends(Sat, Sun) → no change (already at boundaries)
 */
export function expandWeekends(start: Date, end: Date): { start: Date; end: Date } {
  let s = start
  while (isWeekend(subDays(s, 1))) {
    s = subDays(s, 1)
  }
  let e = end
  while (isWeekend(addDays(e, 1))) {
    e = addDays(e, 1)
  }
  return { start: s, end: e }
}

// ─── Strategy Builder ─────────────────────────────────────────────────────────

function buildStrategy(
  holiday: HolidayEntry,
  rangeStart: Date,
  rangeEnd: Date,
  allHolidayDates: Set<string>,
  makeupDates: Set<string>,
  year: number,
  isSuperCombo: boolean,
  idOverride?: string
): Strategy | null {
  const { start: expStart, end: expEnd } = expandWeekends(rangeStart, rangeEnd)
  const { leaveDays, suggestedLeaveDates } = calculateEffectiveLeave(
    expStart,
    expEnd,
    allHolidayDates,
    makeupDates
  )

  const allDays = eachDayOfInterval({ start: expStart, end: expEnd })
  const totalDays = allDays.length

  if (totalDays <= 0) return null

  const isFreebie = leaveDays === 0
  const cpValue = isFreebie ? null : totalDays / leaveDays

  if (!isFreebie && cpValue! < 2.0) return null

  // Collect colored date arrays
  const holidayDates: string[] = []
  const weekendDates: string[] = []
  for (const day of allDays) {
    const dateStr = format(day, 'yyyy-MM-dd')
    if (allHolidayDates.has(dateStr)) {
      holidayDates.push(dateStr)
    } else if (isWeekend(day) && !makeupDates.has(dateStr)) {
      weekendDates.push(dateStr)
    }
  }

  const slugBase = slugify(holiday.name)
  const comboSuffix = isSuperCombo ? '-super-combo' : ''
  const id = idOverride ?? `${slugBase}-${year}${comboSuffix}`

  return {
    id,
    name: isSuperCombo ? `${holiday.name} 大禮包` : holiday.name,
    year,
    leaveDays,
    totalDays,
    cpValue,
    start: format(expStart, 'yyyy-MM-dd'),
    end: format(expEnd, 'yyyy-MM-dd'),
    suggestedLeaveDates,
    holidayDates,
    weekendDates,
    isFreebie,
    isOfficial: holiday.is_official,
    isSuperCombo,
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const SKIP_HOLIDAYS = new Set(['元旦'])  // Standalone New Year's rarely yields CP >= 2

export function calculateStrategies(year: number, holidays: HolidayEntry[]): Strategy[] {
  const regularHolidays = holidays.filter(
    h => h.type === 'holiday' && !SKIP_HOLIDAYS.has(h.name.replace(/（.*?）/g, '').trim())
  )
  const makeupHolidays = holidays.filter(h => h.type === 'makeup_work')

  // Build date lookup sets
  const allHolidayDates = new Set<string>()
  for (const h of regularHolidays) {
    for (const day of eachDayOfInterval({ start: parseISO(h.start), end: parseISO(h.end) })) {
      allHolidayDates.add(format(day, 'yyyy-MM-dd'))
    }
  }
  const makeupDates = new Set<string>(makeupHolidays.map(h => h.start))

  const strategies: Strategy[] = []

  // ── Per-holiday strategies ──────────────────────────────────────────────────
  for (const holiday of regularHolidays) {
    const hStart = parseISO(holiday.start)
    const hEnd = parseISO(holiday.end)
    const { start: baseStart, end: baseEnd } = expandWeekends(hStart, hEnd)

    // Freebie: just the holiday + adjacent weekends, no leave taken
    const freebie = buildStrategy(holiday, baseStart, baseEnd, allHolidayDates, makeupDates, year, false)
    if (freebie) strategies.push(freebie)

    // Enumerate leave extensions: front 0-3 days, back 0-3 days, total ≤ 5
    for (let front = 0; front <= 3; front++) {
      for (let back = 0; back <= 3; back++) {
        if (front === 0 && back === 0) continue // freebie already handled
        if (front + back > 5) continue

        // Walk backward from baseStart to find `front` actual workdays
        let leaveStart = baseStart
        let remaining = front
        while (remaining > 0) {
          leaveStart = subDays(leaveStart, 1)
          const ds = format(leaveStart, 'yyyy-MM-dd')
          if ((!isWeekend(leaveStart) && !allHolidayDates.has(ds)) || makeupDates.has(ds)) remaining--
        }

        // Walk forward from baseEnd to find `back` actual workdays
        let leaveEnd = baseEnd
        remaining = back
        while (remaining > 0) {
          leaveEnd = addDays(leaveEnd, 1)
          const ds = format(leaveEnd, 'yyyy-MM-dd')
          if ((!isWeekend(leaveEnd) && !allHolidayDates.has(ds)) || makeupDates.has(ds)) remaining--
        }

        const strategy = buildStrategy(holiday, leaveStart, leaveEnd, allHolidayDates, makeupDates, year, false)
        if (strategy) strategies.push(strategy)
      }
    }
  }

  // ── Super combo: pairs with gap ≤ 3 workdays ───────────────────────────────
  for (let i = 0; i < regularHolidays.length; i++) {
    for (let j = i + 1; j < regularHolidays.length; j++) {
      const h1 = regularHolidays[i]
      const h2 = regularHolidays[j]
      const h1End = parseISO(h1.end)
      const h2Start = parseISO(h2.start)

      if (h2Start <= h1End) continue // overlapping, skip

      let gapWorkdays = 0
      let cur = addDays(h1End, 1)
      while (cur < h2Start) {
        const ds = format(cur, 'yyyy-MM-dd')
        if (!isWeekend(cur) && !allHolidayDates.has(ds)) gapWorkdays++
        cur = addDays(cur, 1)
      }

      if (gapWorkdays > 0 && gapWorkdays <= 3) {
        const { start: comboStart } = expandWeekends(parseISO(h1.start), parseISO(h1.end))
        const { end: comboEnd } = expandWeekends(parseISO(h2.start), parseISO(h2.end))

        const comboEntry: HolidayEntry = {
          ...h1,
          name: `${h1.name.replace(/（.*?）/g, '').trim()}+${h2.name.replace(/（.*?）/g, '').trim()}`,
          end: h2.end,
          is_official: h1.is_official && h2.is_official,
        }

        const h1Slug = slugify(h1.name)
        const h2Slug = slugify(h2.name)
        const comboId = `${h1Slug}-${h2Slug}-${year}-super-combo`

        const superStrategy = buildStrategy(
          comboEntry,
          comboStart,
          comboEnd,
          allHolidayDates,
          makeupDates,
          year,
          true,
          comboId
        )
        if (superStrategy) strategies.push(superStrategy)
      }
    }
  }

  // ── Deduplication ──────────────────────────────────────────────────────────
  const seen = new Map<string, Strategy>()
  for (const s of strategies) {
    const key = `${s.start}|${s.end}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, s)
    } else {
      const sCP = s.cpValue ?? -1
      const exCP = existing.cpValue ?? -1
      if (sCP > exCP) {
        seen.set(key, s)
      }
    }
  }

  // ── Sort: freebies first, then by cpValue descending ───────────────────────
  return Array.from(seen.values()).sort((a, b) => {
    if (a.isFreebie && !b.isFreebie) return -1
    if (!a.isFreebie && b.isFreebie) return 1
    return (b.cpValue ?? 0) - (a.cpValue ?? 0)
  })
}
