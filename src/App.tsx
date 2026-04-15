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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [budget, setBudget] = useState(3)

  const strategies = calculateStrategies(
    selectedYear,
    (holidaysData as Record<string, HolidayEntry[]>)[String(selectedYear)]
  )
  const allYearHolidayDates = getAllHolidayDates(
    (holidaysData as Record<string, HolidayEntry[]>)[String(selectedYear)] ?? []
  )

  // Lock body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sheetOpen])

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
    setSheetOpen(true)

    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  function handleSelectStrategy(strategy: Strategy) {
    setSelectedStrategy(strategy)
    setSheetOpen(true)
    window.history.replaceState(null, '', '#' + strategy.id)
  }

  function handleCloseSheet() {
    setSheetOpen(false)
  }

  function handleYearChange(year: Year) {
    setSelectedYear(year)
    setSelectedStrategy(null)
    setSheetOpen(false)
    setShowAll(false)
    window.history.replaceState(null, '', location.pathname)
  }

  function handleBudgetChange(delta: number) {
    setBudget(prev => Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, prev + delta)))
    setShowAll(false)
  }

  // ── Budget filtering ────────────────────────────────────────────────────────
  const freebies = strategies.filter(s => s.isFreebie)
  const withinBudget = strategies.filter(s => !s.isFreebie && s.leaveDays <= budget)
  const upsells = strategies.filter(s => !s.isFreebie && s.leaveDays === budget + 1)
  const displayStrategies = [...freebies, ...withinBudget, ...upsells]

  const INITIAL_SHOW = 5

  const allListItems: ListItem[] = []
  displayStrategies.forEach((s, i) => {
    allListItems.push({ type: 'strategy', strategy: s })
    if (i === 0 || i === 2) {
      allListItems.push({ type: 'ad', key: `ad-${i}` })
    }
  })

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

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="py-6 border-t border-slate-100 text-center space-y-1">
          <p className="text-xs text-slate-400">
            2027 年假表依農曆週期預估，正式請假請依行政院人事行政總處公告為準。
          </p>
          <p className="text-xs text-slate-300">© 2026 vacay.tw</p>
        </footer>
      </div>

      {/* ── Calendar Bottom Sheet ───────────────────────────────── */}
      {selectedStrategy && (
        <>
          {/* Backdrop */}
          <div
            className={[
              'fixed inset-0 bg-black/40 z-40 transition-opacity duration-300',
              sheetOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
            ].join(' ')}
            onClick={handleCloseSheet}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="月曆預覽"
            className={[
              'fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl',
              'transition-transform duration-300 ease-out',
              'max-h-[88vh] flex flex-col',
              sheetOpen ? 'translate-y-0' : 'translate-y-full',
            ].join(' ')}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-3 shrink-0">
              <div>
                <p className="text-base font-bold text-slate-900 leading-tight">
                  {selectedStrategy.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedStrategy.start} → {selectedStrategy.end}
                  　·　共 {selectedStrategy.totalDays} 天
                </p>
              </div>
              <button
                onClick={handleCloseSheet}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-lg leading-none transition-colors"
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-5 pb-6 flex-1">
              <Calendar
                key={selectedStrategy.id}
                month={selectedStrategy.start.slice(0, 7)}
                holidayDates={allYearHolidayDates}
                leaveDates={selectedStrategy.suggestedLeaveDates}
                weekendDates={selectedStrategy.weekendDates}
              />

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
                className="w-full mt-4 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors"
              >
                📤 分享這個攻略
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hidden share card for screenshot */}
      {selectedStrategy && <ShareCard strategy={selectedStrategy} />}
    </div>
  )
}
