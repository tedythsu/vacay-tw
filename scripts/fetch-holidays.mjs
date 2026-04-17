/**
 * fetch-holidays.mjs
 *
 * Fetches Taiwan public holiday data from ruyut/TaiwanCalendar (CC BY 4.0)
 * https://github.com/ruyut/TaiwanCalendar
 *
 * Transforms the per-day flat format into the HolidayEntry[] range format
 * expected by src/engine/strategy.ts, then writes src/data/holidays.json.
 *
 * Run: node scripts/fetch-holidays.mjs
 * Called automatically via npm prebuild / predev hooks.
 *
 * Fails gracefully: if the network is unavailable the existing
 * holidays.json is left untouched and the build continues.
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(__dirname, '../src/data/holidays.json')

// Descriptions that signal a government-mandated makeup work day (補班)
const MAKEUP_WORK_DESCS = new Set(['補行上班', '調整上班'])

// Maps ruyut's per-day description strings to the canonical holiday name
// used by the strategy engine's SLUG_MAP and display logic.
const CANONICAL_NAMES = {
  // Lunar New Year (various descriptions across days)
  '春節':     '農曆新年',
  '農曆除夕': '農曆新年',
  '小年夜':   '農曆新年',
  // Individual holidays (ruyut may use different names than the app's SLUG_MAP)
  '開國紀念日':               '元旦',
  '元旦':                     '元旦',
  '和平紀念日':               '和平紀念日',
  '兒童節':                   '兒童節',
  '清明節':                   '清明節',
  '勞動節':                   '勞動節',
  '端午節':                   '端午節',
  '中秋節':                   '中秋節',
  '國慶日':                   '國慶日',
  '孔子誕辰紀念日/教師節':    '教師節',
  '教師節':                   '教師節',
  '臺灣光復暨金門古寧頭大捷紀念日': '光復節',
  '光復節':                   '光復節',
  '行憲紀念日':               '行憲紀念日',
}

const NAME_EN = {
  '農曆新年':   'Lunar New Year',
  '元旦':       "New Year's Day",
  '和平紀念日': 'Peace Memorial Day',
  '兒童節':     "Children's Day",
  '清明節':     'Tomb Sweeping Day',
  '勞動節':     'Labor Day',
  '端午節':     'Dragon Boat Festival',
  '中秋節':     'Mid-Autumn Festival',
  '國慶日':     'National Day',
  '教師節':     "Teacher's Day",
  '光復節':     'Taiwan Retrocession Day',
  '行憲紀念日': 'Constitution Day',
}

/** Convert ruyut's compact YYYYMMDD string to yyyy-MM-dd */
function toDateStr(d) {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

/**
 * Split a contiguous run of isHoliday:true days into named HolidayEntry groups.
 *
 * Algorithm:
 *  1. Collect only the "named anchor" positions — days with a non-補假,
 *     non-empty description that maps to a canonical name.
 *  2. If all anchors share the same canonical → one group spanning the full run.
 *  3. If anchors have different canonicals → split at each canonical boundary.
 *     Days before the first anchor (e.g. a leading 補假) attach to the first
 *     anchor's group. Days after the last anchor attach to the last group.
 */
function splitRun(run) {
  const anchors = run
    .map((day, i) => {
      const canonical = CANONICAL_NAMES[day.description]
      return canonical ? { i, canonical } : null
    })
    .filter(Boolean)

  if (anchors.length === 0) return [] // pure unnamed weekend block, ignore

  const uniqueCanonicals = [...new Set(anchors.map(a => a.canonical))]

  // Single canonical → one entry spanning the full run
  if (uniqueCanonicals.length === 1) {
    return [{
      name:   uniqueCanonicals[0],
      nameEn: NAME_EN[uniqueCanonicals[0]] ?? uniqueCanonicals[0],
      start:  toDateStr(run[0].date),
      end:    toDateStr(run[run.length - 1].date),
      type:   'holiday',
    }]
  }

  // Multiple canonicals → split at each canonical boundary
  const groups = []
  let segStart = 0

  for (let k = 0; k < anchors.length; k++) {
    const isLast = k === anchors.length - 1
    const nextAnchor = anchors[k + 1]

    if (!isLast && anchors[k].canonical !== nextAnchor.canonical) {
      // Boundary is between anchors[k].i and nextAnchor.i
      // Everything from segStart … anchors[k].i belongs to this group
      const segEnd = anchors[k].i
      groups.push({
        name:   anchors[k].canonical,
        nameEn: NAME_EN[anchors[k].canonical] ?? anchors[k].canonical,
        start:  toDateStr(run[segStart].date),
        end:    toDateStr(run[segEnd].date),
        type:   'holiday',
      })
      segStart = anchors[k].i + 1
    }

    if (isLast) {
      groups.push({
        name:   anchors[k].canonical,
        nameEn: NAME_EN[anchors[k].canonical] ?? anchors[k].canonical,
        start:  toDateStr(run[segStart].date),
        end:    toDateStr(run[run.length - 1].date),
        type:   'holiday',
      })
    }
  }

  return groups
}

/**
 * Transform a year's flat ruyut day array into HolidayEntry[] ranges.
 *
 * Step 1: Collect makeup work days (補行上班 / 調整上班) as single-day entries.
 * Step 2: Collect contiguous runs of isHoliday:true days, then call splitRun()
 *         to handle pre-/post-補假 correctly and split adjacent holidays.
 */
function transform(days) {
  const entries = []
  let run = null

  for (const day of days) {
    // Makeup work day — standalone entry, never part of a holiday run
    if (!day.isHoliday && MAKEUP_WORK_DESCS.has(day.description)) {
      entries.push({
        name:   day.description,
        nameEn: 'Makeup Work Day',
        start:  toDateStr(day.date),
        end:    toDateStr(day.date),
        type:   'makeup_work',
      })
      continue
    }

    if (day.isHoliday) {
      if (!run) run = []
      run.push(day)
    } else {
      if (run) {
        entries.push(...splitRun(run))
        run = null
      }
    }
  }
  if (run) entries.push(...splitRun(run))

  return entries.sort((a, b) => a.start.localeCompare(b.start))
}

async function fetchYear(year) {
  const url = `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function main() {
  const currentYear = new Date().getFullYear()
  const result = {}

  for (const year of [currentYear, currentYear + 1]) {
    process.stdout.write(`fetch-holidays: fetching ${year}... `)
    const data = await fetchYear(year)
    if (!data) {
      console.log('not available, skipping.')
      continue
    }
    result[String(year)] = transform(data)
    console.log(`${result[String(year)].length} entries`)
  }

  if (Object.keys(result).length === 0) {
    console.warn('fetch-holidays: no data fetched — keeping existing holidays.json.')
    return
  }

  writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n')
  console.log('fetch-holidays: ✓ wrote src/data/holidays.json')
}

main().catch(err => {
  // Non-fatal: let the build continue with the existing cached file.
  console.warn('fetch-holidays: error —', err.message, '— keeping existing holidays.json.')
})
