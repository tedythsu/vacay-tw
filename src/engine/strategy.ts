import {
  eachDayOfInterval,
  isWeekend,
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
  return SLUG_MAP[base] ?? base.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
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
 * Expand a date range outward to include adjacent weekends.
 * e.g. if start is Monday and the day before is Sunday, pull start to Sunday.
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
