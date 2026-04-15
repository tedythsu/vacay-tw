import { describe, it, expect } from 'vitest'
import { slugify, calculateEffectiveLeave } from './strategy'
import type { HolidayEntry } from './strategy'

describe('slugify', () => {
  it('maps Chinese holiday names to URL-safe slugs', () => {
    expect(slugify('農曆新年')).toBe('lunar-new-year')
    expect(slugify('端午節')).toBe('dragon-boat-festival')
    expect(slugify('中秋節')).toBe('mid-autumn-festival')
    expect(slugify('國慶日')).toBe('national-day')
    expect(slugify('和平紀念日')).toBe('peace-memorial-day')
    expect(slugify('勞動節')).toBe('labor-day')
  })

  it('produces only lowercase alphanumeric and hyphens', () => {
    const result = slugify('農曆新年')
    expect(result).toMatch(/^[a-z0-9-]+$/)
  })
})

describe('calculateEffectiveLeave', () => {
  const holidayDates = new Set(['2026-10-06', '2026-10-10', '2026-10-12'])
  const makeupDates = new Set<string>()

  it('counts only workdays in range as leave days', () => {
    // Oct 7 (Wed), Oct 8 (Thu), Oct 9 (Fri) are workdays between 中秋 and 國慶
    const result = calculateEffectiveLeave(
      new Date('2026-10-07T00:00:00'),
      new Date('2026-10-09T00:00:00'),
      holidayDates,
      makeupDates
    )
    expect(result.leaveDays).toBe(3)
    expect(result.suggestedLeaveDates).toEqual(['2026-10-07', '2026-10-08', '2026-10-09'])
  })

  it('does not count holidays as leave days', () => {
    const result = calculateEffectiveLeave(
      new Date('2026-10-06T00:00:00'),
      new Date('2026-10-07T00:00:00'),
      holidayDates,
      makeupDates
    )
    // Oct 6 is a holiday, Oct 7 is a workday
    expect(result.leaveDays).toBe(1)
    expect(result.suggestedLeaveDates).toEqual(['2026-10-07'])
  })

  it('does not count weekends as leave days', () => {
    // Oct 3 (Sat), Oct 4 (Sun), Oct 5 (Mon) — only Mon is a workday
    const result = calculateEffectiveLeave(
      new Date('2026-10-03T00:00:00'),
      new Date('2026-10-05T00:00:00'),
      holidayDates,
      makeupDates
    )
    expect(result.leaveDays).toBe(1)
    expect(result.suggestedLeaveDates).toEqual(['2026-10-05'])
  })

  it('counts makeup workdays (weekends designated as workdays) as leave days', () => {
    const makeupDatesWithSat = new Set(['2026-02-07'])
    const result = calculateEffectiveLeave(
      new Date('2026-02-07T00:00:00'),
      new Date('2026-02-07T00:00:00'),
      new Set(),
      makeupDatesWithSat
    )
    expect(result.leaveDays).toBe(1)
    expect(result.suggestedLeaveDates).toEqual(['2026-02-07'])
  })
})
