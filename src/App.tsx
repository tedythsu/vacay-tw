import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { calculateStrategies, getAllHolidayDates } from './engine/strategy'
import { StrategyCard } from './components/StrategyCard'
import { Calendar } from './components/Calendar'
import { YearCalendarSheet } from './components/YearCalendarSheet'
import type { HolidayEntry } from './engine/strategy'
import holidaysData from './data/holidays.json'

const ALL_HOLIDAYS = holidaysData as Record<string, HolidayEntry[]>
const confirmedYears = Object.keys(ALL_HOLIDAYS).map(Number).sort()

function yearOfStrategyId(id: string): number | null {
  const m = id.match(/(\d{4})/)
  const y = m ? Number(m[1]) : null
  return y && confirmedYears.includes(y) ? y : null
}

const MIN_BUDGET = 1
const MAX_BUDGET = 30

const today = format(new Date(), 'yyyy-MM-dd')

// Pre-compute all years at module init — data is static, no reason to recompute on interaction.
// Year-tab switching becomes an O(1) Map lookup instead of a 300ms blocking calculation.
const ALL_STRATEGIES = new Map(
  confirmedYears.map(y => [y, calculateStrategies(y, ALL_HOLIDAYS[String(y)] ?? [])])
)
const ALL_HOLIDAY_DATES = new Map(
  confirmedYears.map(y => [y, getAllHolidayDates(ALL_HOLIDAYS[String(y)] ?? [])])
)

export default function App() {
  const [selectedYear, setSelectedYear] = useState<number>(confirmedYears[0])
  const [selectedStrategy, setSelectedStrategy] = useState<ReturnType<typeof calculateStrategies>[number] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showFreebies, setShowFreebies] = useState(false)
  const [budget, setBudget] = useState(3)
  const [toggledGroups, setToggledGroups] = useState<Set<number>>(new Set())
  const [shareCopied, setShareCopied] = useState(false)
  const [yearCalOpen, setYearCalOpen] = useState(false)

  const sheetRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  // Keeps last strategy visible during the slide-out animation (selectedStrategy clears on close)
  const lastStrategyRef = useRef<typeof allStrategies[number] | null>(null)
  if (selectedStrategy) lastStrategyRef.current = selectedStrategy
  const displayStrategy = selectedStrategy ?? lastStrategyRef.current

  const allStrategies = ALL_STRATEGIES.get(selectedYear) ?? []
  // Only keep strategies whose end date is today or in the future
  const strategies = allStrategies.filter(s => s.end >= today)

  const allYearHolidayDates = ALL_HOLIDAY_DATES.get(selectedYear) ?? []

  // Lock body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sheetOpen])

  // Focus management: move focus into sheet on open, return to trigger on close
  useEffect(() => {
    if (sheetOpen && sheetRef.current) {
      sheetRef.current.focus()
    } else if (!sheetOpen && triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [sheetOpen])

  // Deep-link initialization: read URL hash on mount
  useEffect(() => {
    const hash = location.hash.slice(1)
    if (!hash) return

    const year = yearOfStrategyId(hash)
    if (!year) return

    const yearStrategies = calculateStrategies(year, ALL_HOLIDAYS[String(year)] ?? [])
    const match = yearStrategies.find(s => s.id === hash)
    if (!match) return

    setSelectedYear(year)
    setSelectedStrategy(match)
    setSheetOpen(true)

    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  function handleSelectStrategy(strategy: ReturnType<typeof calculateStrategies>[number]) {
    triggerRef.current = document.activeElement as HTMLElement
    setSelectedStrategy(strategy)
    setSheetOpen(true)
    window.history.replaceState(null, '', '#' + strategy.id)
  }

  function handleCloseSheet() {
    setSheetOpen(false)
    setSelectedStrategy(null)
    window.history.replaceState(null, '', location.pathname)
  }

  function handleYearChange(year: number) {
    setSelectedYear(year)
    setSelectedStrategy(null)
    setSheetOpen(false)
    setYearCalOpen(false)
    setShowFreebies(false)
    setToggledGroups(new Set())
    window.history.replaceState(null, '', location.pathname)
  }

  function handleBudgetChange(delta: number) {
    setBudget(prev => Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, prev + delta)))
    setShowFreebies(false)
    setToggledGroups(new Set())
  }

  function toggleGroup(days: number) {
    setToggledGroups(prev => {
      const next = new Set(prev)
      if (next.has(days)) next.delete(days)
      else next.add(days)
      return next
    })
  }

  // ── Budget filtering ────────────────────────────────────────────────────────
  const freebies = strategies.filter(s => s.isFreebie)
  const exactBudget = strategies.filter(s => !s.isFreebie && s.leaveDays === budget)

  type S = typeof exactBudget[number]

  // Sort: most days first, then earliest date as tiebreaker
  const compareFn = (a: S, b: S) =>
    b.totalDays - a.totalDays || a.start.localeCompare(b.start)

  const paidStrategies = [...exactBudget].sort(compareFn)

  // Group paid strategies by totalDays (desc)
  const groupedPaid: [number, S[]][] = []
  {
    const map = new Map<number, S[]>()
    for (const s of paidStrategies) {
      if (!map.has(s.totalDays)) map.set(s.totalDays, [])
      map.get(s.totalDays)!.push(s)
    }
    for (const entry of [...map.entries()].sort((a, b) => b[0] - a[0])) {
      groupedPaid.push(entry)
    }
  }

  return (
    <div className="min-h-screen bg-page font-sans">
      <main className="max-w-lg mx-auto px-4" inert={(sheetOpen || yearCalOpen) || undefined}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="pt-8 pb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            vacay.tw
          </h1>
          <p className="text-sm text-slate-500 mt-1">台灣請假攻略</p>
        </header>

        {/* ── Year Tabs + Holiday count row ───────────────────────── */}
        <div className="border-b border-slate-100 mb-4">
          {confirmedYears.length > 1 && (
            <div role="group" aria-label="年份選擇" className="flex border-b border-slate-100">
              {confirmedYears.map(year => (
                <button
                  key={year}
                  aria-pressed={selectedYear === year}
                  onClick={() => handleYearChange(year)}
                  className={[
                    'flex-1 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset',
                    selectedYear === year
                      ? 'text-brand-600 border-b-2 border-brand-600 -mb-[1px]'
                      : 'text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
          {/* Holiday overview trigger — anchored to the year context */}
          <button
            onClick={() => setYearCalOpen(true)}
            className="w-full flex items-center justify-between py-2.5 text-xs text-slate-600 hover:text-brand-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 rounded"
          >
            <span className="font-medium">{selectedYear} 國定假日總覽</span>
            <span aria-hidden="true" className="text-slate-400">›</span>
          </button>
        </div>

        {/* ── Budget Stepper ──────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-md px-4 py-4 mb-6">
          <span className="text-sm text-slate-600">我要請</span>
          <div role="group" aria-label="請假天數" className="flex items-center gap-2">
            <button
              onClick={() => handleBudgetChange(-1)}
              disabled={budget <= MIN_BUDGET}
              className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 font-bold text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              aria-label="減少請假天數"
            >
              −
            </button>
            <span
              aria-label={`目前 ${budget} 天`}
              className="text-3xl font-bold text-brand-600 w-9 text-center tabular-nums"
            >
              {budget}
            </span>
            <button
              onClick={() => handleBudgetChange(1)}
              disabled={budget >= MAX_BUDGET}
              className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 font-bold text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              aria-label="增加請假天數"
            >
              +
            </button>
          </div>
          <span className="text-sm text-slate-600">天假</span>
        </div>

        {/* ── Paid Strategy List (grouped by 連休天數) ────────────── */}
        {paidStrategies.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-500">沒有符合條件的方案</p>
          </div>
        ) : (
          <div className="mb-2 space-y-2">
            {groupedPaid.map(([totalDays, group], gi) => {
              const isBestGroup = gi === 0
              // Best group: open by default, toggled = closed. Others: closed by default, toggled = open.
              const collapsed = isBestGroup ? toggledGroups.has(totalDays) : !toggledGroups.has(totalDays)
              return (
                <div
                  key={totalDays}
                  className={[
                    'rounded-2xl border px-3 pt-1 pb-1',
                    isBestGroup
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-slate-100 bg-white',
                  ].join(' ')}
                >
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(totalDays)}
                    aria-expanded={!collapsed}
                    className="w-full flex items-center justify-between py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 rounded-lg"
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-slate-500">連休</span>
                      <span className={['tabular-nums leading-none', isBestGroup ? 'text-xl font-bold text-amber-700' : 'text-xl font-bold text-slate-800'].join(' ')}>{totalDays}</span>
                      <span className="text-xs text-slate-500">天</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isBestGroup && (
                        <span className="text-xs bg-amber-400 text-white px-2 py-0.5 rounded-full font-semibold">
                          ★ 最佳
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{group.length} 個方案</span>
                      <span
                        aria-hidden="true"
                        className={['text-slate-400 text-sm leading-none transition-transform duration-200', collapsed ? '' : 'rotate-90'].join(' ')}
                      >
                        ›
                      </span>
                    </div>
                  </button>

                  {/* Cards */}
                  {!collapsed && (
                    <div className="space-y-3 pb-3">
                      {group.map(s => (
                        <div key={s.id} id={s.id}>
                          <StrategyCard
                            strategy={s}
                            isSelected={selectedStrategy?.id === s.id}
  
                            onSelect={() => handleSelectStrategy(s)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Freebies section ────────────────────────────────────── */}
        {freebies.length > 0 && (
          <div className="mt-2">
            {/* Freebies */}
            <div className="rounded-2xl border border-green-300 bg-green-50 px-3 pt-1 pb-1">
              <button
                onClick={() => setShowFreebies(prev => !prev)}
                aria-expanded={showFreebies}
                className="w-full flex items-center justify-between py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 rounded-lg"
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-slate-500">國定連假</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{freebies.length} 個方案</span>
                  <span
                    aria-hidden="true"
                    className={['text-slate-400 text-sm leading-none transition-transform duration-200', showFreebies ? 'rotate-90' : ''].join(' ')}
                  >
                    ›
                  </span>
                </div>
              </button>
              {showFreebies && (
                <div className="space-y-3 pb-3">
                  {freebies.map(s => (
                    <div key={s.id} id={s.id}>
                      <StrategyCard
                        strategy={s}
                        isSelected={selectedStrategy?.id === s.id}
                        showTotalDays
                        onSelect={() => handleSelectStrategy(s)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="py-6 border-t border-slate-100 text-center space-y-1">
          <p className="text-xs text-slate-500">
            正式請假請依行政院人事行政總處公告為準。
          </p>
          <p className="text-xs text-slate-500">© {confirmedYears[confirmedYears.length - 1]} vacay.tw</p>
        </footer>
      </main>

      {/* ── Year Calendar Sheet ─────────────────────────────────── */}
      <YearCalendarSheet
        year={selectedYear}
        holidays={ALL_HOLIDAYS[String(selectedYear)] ?? []}
        isOpen={yearCalOpen}
        onClose={() => setYearCalOpen(false)}
      />

      {/* ── Calendar Bottom Sheet ───────────────────────────────── */}
      {/* Always in DOM so CSS transition runs on both open and close */}
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
          ref={sheetRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="月曆預覽"
          className={[
            'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-white rounded-t-3xl shadow-2xl',
            'transition-transform duration-300 ease-out',
            'max-h-[88vh] flex flex-col focus-visible:outline-none',
            sheetOpen ? 'translate-y-0' : 'translate-y-full',
          ].join(' ')}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-slate-200 rounded-full" />
          </div>

          {displayStrategy && (
            <>
              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 py-4 shrink-0">
                <div>
                  <p className="text-base font-bold text-slate-900 leading-tight">
                    {displayStrategy.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {displayStrategy.start} → {displayStrategy.end}　·　共 {displayStrategy.totalDays} 天
                  </p>
                </div>
                <button
                  onClick={handleCloseSheet}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  aria-label="關閉"
                >
                  ×
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto px-5 pb-6 flex-1">
                <Calendar
                  key={displayStrategy.id}
                  month={displayStrategy.start.slice(0, 7)}
                  holidayDates={allYearHolidayDates}
                  leaveDates={displayStrategy.suggestedLeaveDates}
                  weekendDates={displayStrategy.weekendDates}
                />

                <button
                  onClick={async () => {
                    const url = `${location.origin}${location.pathname}#${displayStrategy.id}`
                    if (navigator.share) {
                      await navigator.share({ title: displayStrategy.name, url })
                    } else {
                      await navigator.clipboard.writeText(url)
                      setShareCopied(true)
                      setTimeout(() => setShareCopied(false), 2000)
                    }
                  }}
                  className="w-full mt-4 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  <span aria-live="polite">{shareCopied ? '已複製連結 ✓' : '分享這個攻略'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </>

    </div>
  )
}
