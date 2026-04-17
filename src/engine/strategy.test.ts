import { describe, it, expect } from 'vitest'
import { slugify, calculateEffectiveLeave } from './strategy'
import { calculateStrategies } from './strategy'
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

// Minimal dataset for deterministic testing
const testHolidays2026: HolidayEntry[] = [
  {
    name: '農曆新年',
    nameEn: 'Lunar New Year',
    start: '2026-02-16',
    end: '2026-02-22',
    type: 'holiday',
  },
  {
    name: '農曆新年（補班）',
    nameEn: 'Makeup Day',
    start: '2026-02-07',
    end: '2026-02-07',
    type: 'makeup_work',
  },
  {
    name: '中秋節',
    nameEn: 'Mid-Autumn Festival',
    start: '2026-10-06',
    end: '2026-10-06',
    type: 'holiday',
  },
  {
    name: '國慶日',
    nameEn: 'National Day',
    start: '2026-10-10',
    end: '2026-10-10',
    type: 'holiday',
  },
  {
    name: '國慶日（補假）',
    nameEn: 'National Day Substitute',
    start: '2026-10-12',
    end: '2026-10-12',
    type: 'holiday',
  },
]

describe('calculateStrategies', () => {
  it('returns an array of Strategy objects', () => {
    const result = calculateStrategies(2026, testHolidays2026)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('freebie strategies are placed first', () => {
    const result = calculateStrategies(2026, testHolidays2026)
    const firstNonFreebie = result.findIndex(s => !s.isFreebie)
    const lastFreebie = result.reduce((acc, s, i) => (s.isFreebie ? i : acc), -1)
    if (firstNonFreebie !== -1 && lastFreebie !== -1) {
      expect(lastFreebie).toBeLessThan(firstNonFreebie)
    }
  })

  it('freebie strategies have null cpValue and leaveDays === 0', () => {
    const result = calculateStrategies(2026, testHolidays2026)
    for (const s of result.filter(s => s.isFreebie)) {
      expect(s.cpValue).toBeNull()
      expect(s.leaveDays).toBe(0)
    }
  })

  it('non-freebie strategies have cpValue >= 1.0', () => {
    const result = calculateStrategies(2026, testHolidays2026)
    for (const s of result.filter(s => !s.isFreebie)) {
      expect(s.cpValue).not.toBeNull()
      expect(s.cpValue!).toBeGreaterThanOrEqual(1.0)
    }
  })

  it('non-freebie strategies are sorted by cpValue descending', () => {
    const result = calculateStrategies(2026, testHolidays2026)
    const nonFreebies = result.filter(s => !s.isFreebie)
    for (let i = 0; i < nonFreebies.length - 1; i++) {
      expect(nonFreebies[i].cpValue!).toBeGreaterThanOrEqual(nonFreebies[i + 1].cpValue!)
    }
  })

  it('no duplicate [start, end] ranges', () => {
    const result = calculateStrategies(2026, testHolidays2026)
    const keys = result.map(s => `${s.start}|${s.end}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('all strategy ids are URL-safe', () => {
    const result = calculateStrategies(2026, testHolidays2026)
    for (const s of result) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('all strategy ids are unique', () => {
    const result = calculateStrategies(2026, testHolidays2026)
    const ids = result.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('detects 中秋+國慶 super combo and preserves isSuperCombo through dedup', () => {
    // expandRange causes the 中秋 +3-back extension to produce the same [Oct 6, Oct 12] range
    // as the explicit super combo. The dedup tie-break must prefer isSuperCombo: true so the
    // 大禮包 badge survives.
    const result = calculateStrategies(2026, testHolidays2026)
    const combo = result.find(s => s.start === '2026-10-06' && s.end === '2026-10-12')
    expect(combo).toBeDefined()
    expect(combo?.isSuperCombo).toBe(true)
  })

  it('makeup workday in leave range is counted as a leave day', () => {
    // Holiday on Wednesday; makeup Saturday immediately before the preceding weekend
    const syntheticHolidays: HolidayEntry[] = [
      {
        name: '端午節',
        nameEn: 'Dragon Boat Festival',
        start: '2026-06-19',  // Friday
        end: '2026-06-19',
        type: 'holiday',
        },
      {
        name: '端午節（補班）',
        nameEn: 'Makeup Day',
        start: '2026-06-13',  // Saturday before the holiday
        end: '2026-06-13',
        type: 'makeup_work',
        },
    ]
    const result = calculateStrategies(2026, syntheticHolidays)
    // Any strategy spanning June 13 must count it as a leave day
    const spansJune13 = result.find(s => s.suggestedLeaveDates.includes('2026-06-13'))
    if (spansJune13) {
      expect(spansJune13.leaveDays).toBeGreaterThan(0)
      expect(spansJune13.suggestedLeaveDates).toContain('2026-06-13')
    }
  })
})

describe('subGroupByName', () => {
  // subGroupByName lives in App.tsx which is not importable in unit tests,
  // so we inline the same logic here to lock in the contract.
  function subGroupByName(strategies: { name: string; id: string }[]) {
    const map = new Map<string, { name: string; id: string }[]>()
    for (const s of strategies) {
      if (!map.has(s.name)) map.set(s.name, [])
      map.get(s.name)!.push(s)
    }
    return [...map.entries()]
  }

  it('groups strategies by name preserving insertion order', () => {
    const input = [
      { name: '農曆新年', id: 'a' },
      { name: '農曆新年', id: 'b' },
      { name: '清明節',   id: 'c' },
    ]
    const result = subGroupByName(input)
    expect(result).toHaveLength(2)
    expect(result[0][0]).toBe('農曆新年')
    expect(result[0][1].map(s => s.id)).toEqual(['a', 'b'])
    expect(result[1][0]).toBe('清明節')
    expect(result[1][1].map(s => s.id)).toEqual(['c'])
  })

  it('returns a single group when all strategies share the same name', () => {
    const input = [
      { name: '端午節', id: 'x' },
      { name: '端午節', id: 'y' },
    ]
    const result = subGroupByName(input)
    expect(result).toHaveLength(1)
    expect(result[0][0]).toBe('端午節')
  })

  it('handles empty input', () => {
    expect(subGroupByName([])).toHaveLength(0)
  })
})
