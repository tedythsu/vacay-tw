import { useState, useEffect } from 'react'
import { calculateStrategies, getAllHolidayDates } from './engine/strategy'
import { StrategyCard } from './components/StrategyCard'
import { Calendar } from './components/Calendar'
import { AdSlot } from './components/AdSlot'
import { ShareCard } from './components/ShareCard'
import type { Strategy, HolidayEntry } from './engine/strategy'
import holidaysData from './data/holidays.json'

type Year = 2026 | 2027

type ListItem =
  | { type: 'strategy'; strategy: Strategy }
  | { type: 'ad'; key: string }

function parseYearFromId(id: string): Year | null {
  if (id.endsWith('-2026') || id.includes('-2026-')) return 2026
  if (id.endsWith('-2027') || id.includes('-2027-')) return 2027
  return null
}

const MIN_BUDGET = 1
const MAX_BUDGET = 7

export default function App() {
  const [selectedYear, setSelectedYear] = useState<Year>(2026)
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [budget, setBudget] = useState(3)

  const strategies = calculateStrategies(
    selectedYear,
    (holidaysData as Record<string, HolidayEntry[]>)[String(selectedYear)]
  )
  const allYearHolidayDates = getAllHolidayDates(
    (holidaysData as Record<string, HolidayEntry[]>)[String(selectedYear)] ?? []
  )

  // Deep-link initialization: read URL hash on mount
  useEffect(() => {
    const hash = location.hash.slice(1)
    if (!hash) return

    const year = parseYearFromId(hash)
    if (!year) return

    const yearStrategies = calculateStrategies(
      year,
      (holidaysData as Record<string, HolidayEntry[]>)[String(year)]
    )
    const match = yearStrategies.find(s => s.id === hash)
    if (!match) return

    setSelectedYear(year)
    setSelectedStrategy(match)

    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  function handleSelectStrategy(strategy: Strategy) {
    setSelectedStrategy(strategy)
    window.history.replaceState(null, '', '#' + strategy.id)
    setTimeout(() => {
      document.getElementById('calendar-preview')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  function handleYearChange(year: Year) {
    setSelectedYear(year)
    setSelectedStrategy(null)
    setShowAll(false)
    window.history.replaceState(null, '', location.pathname)
  }

  function handleBudgetChange(delta: number) {
    setBudget(prev => Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, prev + delta)))
    setShowAll(false)
  }

  // ── Budget filtering ────────────────────────────────────────────────────────
  // Tier 1: freebies — always shown, not subject to budget
  // Tier 2: leaveDays <= budget — sorted by cpValue desc (engine already does this)
  // Tier 3: leaveDays === budget + 1 — "建議加碼", shown at bottom
  const freebies = strategies.filter(s => s.isFreebie)
  const withinBudget = strategies.filter(s => !s.isFreebie && s.leaveDays <= budget)
  const upsells = strategies.filter(s => !s.isFreebie && s.leaveDays === budget + 1)
  const displayStrategies = [...freebies, ...withinBudget, ...upsells]

  // Build list with AdSlots at positions after index 0 and index 2
  const INITIAL_SHOW = 5

  // Build full list first
  const allListItems: ListItem[] = []
  displayStrategies.forEach((s, i) => {
    allListItems.push({ type: 'strategy', strategy: s })
    if (i === 0 || i === 2) {
      allListItems.push({ type: 'ad', key: `ad-${i}` })
    }
  })

  // Then limit to INITIAL_SHOW strategies if not showing all
  const listItems: ListItem[] = showAll ? allListItems : (() => {
    const result: ListItem[] = []
    let count = 0
    for (const item of allListItems) {
      if (count >= INITIAL_SHOW) break
      result.push(item)
      if (item.type === 'strategy') count++
    }
    return result
  })()

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-lg mx-auto px-4">

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="pt-8 pb-4 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            vacay.tw 🏖️
          </h1>
          <p className="text-sm text-slate-500 mt-1">台灣最強請假攻略</p>
        </header>

        {/* ── Year Tabs ───────────────────────────────────────────── */}
        <div role="tablist" className="flex border-b-2 border-slate-100 mb-4">
          {([2026, 2027] as Year[]).map(year => (
            <button
              key={year}
              role="tab"
              aria-selected={selectedYear === year}
              onClick={() => handleYearChange(year)}
              className={[
                'flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
                selectedYear === year
                  ? 'text-sky-500 border-b-2 border-sky-500 -mb-[2px]'
                  : 'text-slate-400 hover:text-slate-600',
              ].join(' ')}
            >
              {year}
              {year === 2027 && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                  預估
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Budget Stepper ──────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 mb-4">
          <span className="text-sm text-slate-500">我有</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBudgetChange(-1)}
              disabled={budget <= MIN_BUDGET}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 font-bold text-lg leading-none transition-colors"
              aria-label="減少請假天數"
            >
              −
            </button>
            <span className="text-2xl font-extrabold text-sky-500 w-7 text-center tabular-nums">
              {budget}
            </span>
            <button
              onClick={() => handleBudgetChange(1)}
              disabled={budget >= MAX_BUDGET}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 font-bold text-lg leading-none transition-colors"
              aria-label="增加請假天數"
            >
              +
            </button>
          </div>
          <span className="text-sm text-slate-500">天假，幫我找最佳攻略</span>
        </div>

        {/* ── Strategy List ───────────────────────────────────────── */}
        <div className="space-y-3 pb-2">
          {listItems.map(item =>
            item.type === 'ad' ? (
              <AdSlot key={item.key} />
            ) : (
              <div key={item.strategy.id} id={item.strategy.id}>
                <StrategyCard
                  strategy={item.strategy}
                  isSelected={selectedStrategy?.id === item.strategy.id}
                  isUpsell={!item.strategy.isFreebie && item.strategy.leaveDays === budget + 1}
                  onSelect={() => handleSelectStrategy(item.strategy)}
                />
              </div>
            )
          )}
        </div>

        {/* Show more button */}
        {!showAll && displayStrategies.length > INITIAL_SHOW && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-3 text-sm text-slate-500 hover:text-sky-500 border border-dashed border-slate-200 rounded-2xl transition-colors mt-1 mb-2"
          >
            顯示全部 {displayStrategies.length} 個攻略 ↓
          </button>
        )}

        {/* ── Calendar Preview ────────────────────────────────────── */}
        {selectedStrategy && (
          <div id="calendar-preview" className="mt-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1">
              📅 月曆預覽
              <span className="text-xs font-normal text-slate-400">— 點選卡片可切換</span>
            </h2>
            <Calendar
              month={selectedStrategy.start.slice(0, 7)}
              holidayDates={allYearHolidayDates}
              leaveDates={selectedStrategy.suggestedLeaveDates}
              weekendDates={selectedStrategy.weekendDates}
            />

            {/* Share button — triggers ShareCard screenshot (wired in Task 9) */}
            <button
              onClick={async () => {
                const el = document.getElementById('share-card-hidden')
                if (!el) return
                try {
                  await document.fonts.ready
                  const { toPng } = await import('html-to-image')
                  const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true })
                  const link = document.createElement('a')
                  link.download = `vacay-${selectedStrategy.id}.png`
                  link.href = dataUrl
                  link.click()
                } catch (err) {
                  console.error('[share] toPng failed', err)
                }
              }}
              className="w-full mt-3 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors"
            >
              📤 分享這個攻略
            </button>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="py-6 border-t border-slate-100 text-center space-y-1">
          <p className="text-xs text-slate-400">
            2027 年假表依農曆週期預估，正式請假請依行政院人事行政總處公告為準。
          </p>
          <p className="text-xs text-slate-300">© 2026 vacay.tw</p>
        </footer>
      </div>
      {/* Hidden share card for screenshot */}
      {selectedStrategy && <ShareCard strategy={selectedStrategy} />}
    </div>
  )
}
