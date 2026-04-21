import { Analytics } from '@vercel/analytics/react'
import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { calculateStrategies, getAllHolidayDates } from './engine/strategy'
import type { Strategy, HolidayEntry } from './engine/strategy'
import { StrategyCard } from './components/StrategyCard'
import { Calendar } from './components/Calendar'
import { YearCalendarSheet } from './components/YearCalendarSheet'
import { MonthRangePicker } from './components/MonthRangePicker'
import holidaysData from './data/holidays.json'

const ALL_HOLIDAYS = holidaysData as Record<string, HolidayEntry[]>
const confirmedYears = Object.keys(ALL_HOLIDAYS).map(Number).sort()
const baseYear = confirmedYears[0]

// Absolute month position: months since baseYear January (0-indexed)
function encodeYM(year: number, month: number): number {
  return (year - baseYear) * 12 + (month - 1)
}

const MIN_BUDGET = 1
const MAX_BUDGET = 30

const today = format(new Date(), 'yyyy-MM-dd')
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const minPos = encodeYM(currentYear, currentMonth)
const maxPos = encodeYM(confirmedYears[confirmedYears.length - 1], 12)

// Compute per-year strategies. Include next year's Jan+Feb holidays so cross-year
// plans (e.g. 2026-12-28 ~ 2027-01-03) are naturally generated.
const strategiesPerYear = confirmedYears.map(y => {
  const holidays = ALL_HOLIDAYS[String(y)] ?? []
  const nextEarly = (ALL_HOLIDAYS[String(y + 1)] ?? []).filter(
    h => parseInt(h.start.slice(5, 7)) <= 2
  )
  return calculateStrategies(y, [...holidays, ...nextEarly])
})

// Merge all years into one flat list, dedup by start|end
const _seenKeys = new Set<string>()
const ALL_STRATEGIES_FLAT: Strategy[] = []
for (const list of strategiesPerYear) {
  for (const s of list) {
    const key = `${s.start}|${s.end}`
    if (!_seenKeys.has(key)) {
      _seenKeys.add(key)
      ALL_STRATEGIES_FLAT.push(s)
    }
  }
}

// Merged holiday dates across all years for calendar coloring
const ALL_HOLIDAY_DATES_FLAT = confirmedYears.flatMap(
  y => getAllHolidayDates(ALL_HOLIDAYS[String(y)] ?? [])
)

// Parse deep-link hash at module init
function parseHashState() {
  const hash = location.hash.slice(1)
  if (!hash) return null
  const match = ALL_STRATEGIES_FLAT.find(s => s.id === hash)
  if (!match) return null
  return { strategy: match }
}
const INITIAL_HASH_STATE = parseHashState()

function subGroupByName(strategies: Strategy[]): [string, Strategy[]][] {
  const map = new Map<string, Strategy[]>()
  for (const s of strategies) {
    if (!map.has(s.name)) map.set(s.name, [])
    map.get(s.name)!.push(s)
  }
  return [...map.entries()]
}

export default function App() {
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(
    INITIAL_HASH_STATE?.strategy ?? null
  )
  const [sheetOpen, setSheetOpen] = useState(INITIAL_HASH_STATE != null)
  const [showFreebies, setShowFreebies] = useState(false)
  const [budget, setBudget] = useState(3)
  const [mode, setMode] = useState<'a' | 'b'>('a')
  const [modeBDays, setModeBDays] = useState(7)
  const [monthRange, setMonthRange] = useState<[number, number]>(() => {
    if (INITIAL_HASH_STATE) {
      const s = INITIAL_HASH_STATE.strategy
      const sPos = encodeYM(parseInt(s.start.slice(0, 4)), parseInt(s.start.slice(5, 7)))
      return [Math.min(sPos, minPos), maxPos]
    }
    return [minPos, maxPos]
  })
  const [toggledGroups, setToggledGroups] = useState<Set<number>>(new Set())
  const [shareCopied, setShareCopied] = useState(false)
  const [calYear, setCalYear] = useState<number | null>(null)
  const [noDataTip, setNoDataTip] = useState<number | null>(null)

  const sheetRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const [lastStrategy, setLastStrategy] = useState<Strategy | null>(
    INITIAL_HASH_STATE?.strategy ?? null
  )
  const displayStrategy = selectedStrategy ?? lastStrategy

  // Only keep strategies whose end date is today or in the future
  const strategies = ALL_STRATEGIES_FLAT.filter(s => s.end >= today)

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

  // Deep-link: scroll the linked card into view after mount
  useEffect(() => {
    if (!INITIAL_HASH_STATE) return
    const hash = location.hash.slice(1)
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  function handleSelectStrategy(strategy: Strategy) {
    triggerRef.current = document.activeElement as HTMLElement
    setSelectedStrategy(strategy)
    setLastStrategy(strategy)
    setSheetOpen(true)
    if (location.hash !== '#' + strategy.id) {
      window.history.replaceState(null, '', '#' + strategy.id)
    }
  }

  function handleCloseSheet() {
    setSheetOpen(false)
    setSelectedStrategy(null)
    if (location.hash) {
      window.history.replaceState(null, '', location.pathname)
    }
  }

  function handleBudgetChange(delta: number) {
    setBudget(prev => Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, prev + delta)))
    setShowFreebies(false)
    setToggledGroups(new Set())
  }

  function handleModeChange(next: 'a' | 'b') {
    setMode(next)
    setToggledGroups(new Set())
  }

  function handleModeBDaysChange(delta: number) {
    setModeBDays(prev => Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, prev + delta)))
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

  // ── Month filter using absolute year+month positions ─────────────────────────
  function matchesMonthFilter(s: Strategy): boolean {
    const sPos = encodeYM(parseInt(s.start.slice(0, 4)), parseInt(s.start.slice(5, 7)))
    const ePos = encodeYM(parseInt(s.end.slice(0, 4)), parseInt(s.end.slice(5, 7)))
    return sPos <= monthRange[1] && ePos >= monthRange[0]
  }

  // ── Budget filtering ────────────────────────────────────────────────────────
  const freebies = strategies.filter(s => s.isFreebie && matchesMonthFilter(s))
  const exactBudget = strategies.filter(s => !s.isFreebie && s.leaveDays === budget && matchesMonthFilter(s))

  type S = typeof exactBudget[number]

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

  // ── Mode B: filter by totalDays, group by leaveDays (asc) ──────────────────
  const modeBFiltered = strategies
    .filter(s => !s.isFreebie && s.totalDays === modeBDays && matchesMonthFilter(s))
    .sort((a, b) => a.start.localeCompare(b.start))

  const groupedModeB: [number, Strategy[]][] = []
  {
    const map = new Map<number, Strategy[]>()
    for (const s of modeBFiltered) {
      if (!map.has(s.leaveDays)) map.set(s.leaveDays, [])
      map.get(s.leaveDays)!.push(s)
    }
    for (const entry of [...map.entries()].sort((a, b) => a[0] - b[0])) {
      groupedModeB.push(entry)
    }
  }

  return (
    <div className="min-h-screen bg-page font-sans">
      <main className="max-w-lg mx-auto px-4" inert={(sheetOpen || calYear !== null) || undefined}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="pt-10 pb-8 flex justify-center">
          <h1 className="flex flex-col items-center gap-1">
            <span className="text-4xl font-bold tracking-tight text-gray-900">休假小助手</span>
            <span className="text-sm font-medium tracking-widest text-gray-400">VACAY.TW</span>
          </h1>
        </header>

        {/* ── Query Block ──────────────────────────────────────────── */}
        <section aria-labelledby="query-heading" className="bg-white rounded-2xl border border-slate-100 shadow-md px-4 pt-5 pb-6 mb-6">
          <h2 id="query-heading" className="sr-only">查詢條件</h2>

          {/* ── Mode toggle ──────────────────────────────────── */}
          <div className="relative flex bg-slate-100 rounded-[10px] p-[3px] gap-[3px] mb-[18px]" role="radiogroup" aria-label="查詢模式">
            {/* Sliding active pill */}
            <div
              aria-hidden="true"
              className="absolute top-[3px] bottom-[3px] rounded-[8px] bg-white shadow-sm transition-transform duration-200 ease-in-out pointer-events-none"
              style={{ left: '3px', width: 'calc(50% - 4.5px)', transform: mode === 'b' ? 'translateX(calc(100% + 3px))' : 'translateX(0)' }}
            />
            <button
              onClick={() => handleModeChange('a')}
              role="radio"
              className={[
                'relative flex-1 z-10 rounded-[8px] py-[7px] text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                mode === 'a' ? 'text-slate-900' : 'text-slate-400',
              ].join(' ')}
              aria-checked={mode === 'a'}
            >指定請假天數</button>
            <button
              onClick={() => handleModeChange('b')}
              role="radio"
              className={[
                'relative flex-1 z-10 rounded-[8px] py-[7px] text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                mode === 'b' ? 'text-slate-900' : 'text-slate-400',
              ].join(' ')}
              aria-checked={mode === 'b'}
            >指定連休天數</button>
          </div>

          {/* N 天 stepper */}
          <div className="flex items-center justify-center gap-3">
            <div role="group" aria-label={mode === 'a' ? '請假天數' : '目標連休天數'} className="flex items-center gap-2">
              <button
                onClick={() => mode === 'a' ? handleBudgetChange(-1) : handleModeBDaysChange(-1)}
                disabled={(mode === 'a' ? budget : modeBDays) <= MIN_BUDGET}
                className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 font-bold text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                aria-label={mode === 'a' ? '減少請假天數' : '減少連休天數'}
              >−</button>
              <span
                aria-label={`目前 ${mode === 'a' ? budget : modeBDays} 天`}
                className="text-xl font-bold text-brand-600 w-9 text-center tabular-nums"
              >{mode === 'a' ? budget : modeBDays}</span>
              <button
                onClick={() => mode === 'a' ? handleBudgetChange(1) : handleModeBDaysChange(1)}
                disabled={(mode === 'a' ? budget : modeBDays) >= MAX_BUDGET}
                className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center text-slate-700 font-bold text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                aria-label={mode === 'a' ? '增加請假天數' : '增加連休天數'}
              >+</button>
            </div>
            <span className="text-sm text-slate-600">天</span>
          </div>

          {/* 模式說明 */}
          <p className="text-sm text-slate-500 text-center mt-5 mb-3">
            在以下時段，找出搭配國定假日的最佳請假方案
          </p>

          {/* Year+month range slider */}
          <MonthRangePicker
            value={monthRange}
            onChange={setMonthRange}
            minPos={minPos}
            maxPos={maxPos}
            baseYear={baseYear}
          />

          {/* 下一年度資料尚未公布時的提示 */}
          {!ALL_HOLIDAYS[String(confirmedYears[confirmedYears.length - 1] + 1)] && (
            <p className="text-xs text-slate-500 text-center mt-3">
              目前資料至 {confirmedYears[confirmedYears.length - 1]} 年底，{confirmedYears[confirmedYears.length - 1] + 1} 年假期預計由行政院於 6–8 月公布後更新
            </p>
          )}

        </section>

        {/* ── Strategy List ─────────────────────────────────────── */}
        <section aria-labelledby="results-heading">
          <h2 id="results-heading" className="sr-only">休假方案結果</h2>
        {mode === 'a' ? (
          paidStrategies.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">沒有符合條件的方案</p>
            </div>
          ) : (
            <div className="mb-2 space-y-2">
              {groupedPaid.map(([totalDays, group], gi) => {
                const isBestGroup = gi === 0
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
                    <button
                      onClick={() => toggleGroup(totalDays)}
                      aria-expanded={!collapsed}
                      className="w-full flex items-center justify-between py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 rounded-lg"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">連休</span>
                        <span className={['tabular-nums leading-none', isBestGroup ? 'text-xl font-bold text-amber-700' : 'text-xl font-bold text-slate-800'].join(' ')}>{totalDays}</span>
                        <span className="text-xs text-slate-500">天</span>
                        {isBestGroup && (
                          <span className="text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                            <span aria-hidden="true">★ </span>最佳
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{group.length} 個方案</span>
                        <span
                          aria-hidden="true"
                          className={['text-slate-400 text-sm leading-none transition-transform duration-200', collapsed ? '' : 'rotate-90'].join(' ')}
                        >›</span>
                      </div>
                    </button>

                    <div className={['grid transition-[grid-template-rows] duration-200 ease-out', collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'].join(' ')}>
                      <div className="overflow-hidden min-h-0">
                        <div className="pb-1">
                          {subGroupByName(group).map(([name, subs]) => (
                            <div key={name}>
                              <div className="flex items-center gap-2 pt-2 pb-0.5 px-2">
                                <span className="text-xs font-semibold text-slate-500 shrink-0">{name}</span>
                                <div className="flex-1 h-px bg-slate-200" />
                              </div>
                              <div className="divide-y divide-slate-100">
                                {subs.map(s => (
                                  <div key={s.id} id={s.id}>
                                    <StrategyCard
                                      strategy={s}
                                      isSelected={selectedStrategy?.id === s.id}
                                      onSelect={() => handleSelectStrategy(s)}
                                      grouped
                                      hideName
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          groupedModeB.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">沒有符合條件的方案</p>
            </div>
          ) : (
            <div className="mb-2 space-y-2">
              {groupedModeB.map(([leaveDays, group], gi) => {
                const isBestGroup = gi === 0
                const collapsed = isBestGroup ? toggledGroups.has(leaveDays) : !toggledGroups.has(leaveDays)
                return (
                  <div
                    key={leaveDays}
                    className={[
                      'rounded-2xl border px-3 pt-1 pb-1',
                      isBestGroup
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-100 bg-white',
                    ].join(' ')}
                  >
                    <button
                      onClick={() => toggleGroup(leaveDays)}
                      aria-expanded={!collapsed}
                      className="w-full flex items-center justify-between py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 rounded-lg"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">只需請</span>
                        <span className={['tabular-nums leading-none', isBestGroup ? 'text-xl font-bold text-amber-700' : 'text-xl font-bold text-slate-800'].join(' ')}>{leaveDays}</span>
                        <span className="text-xs text-slate-500">天</span>
                        {isBestGroup && (
                          <span className="text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                            <span aria-hidden="true">★ </span>最佳
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{group.length} 個方案</span>
                        <span
                          aria-hidden="true"
                          className={['text-slate-400 text-sm leading-none transition-transform duration-200', collapsed ? '' : 'rotate-90'].join(' ')}
                        >›</span>
                      </div>
                    </button>

                    <div className={['grid transition-[grid-template-rows] duration-200 ease-out', collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'].join(' ')}>
                      <div className="overflow-hidden min-h-0">
                        <div className="pb-1">
                          {subGroupByName(group).map(([name, subs]) => (
                            <div key={name}>
                              <div className="flex items-center gap-2 pt-2 pb-0.5 px-2">
                                <span className="text-xs font-semibold text-slate-500 shrink-0">{name}</span>
                                <div className="flex-1 h-px bg-slate-200" />
                              </div>
                              <div className="divide-y divide-slate-100">
                                {subs.map(s => (
                                  <div key={s.id} id={s.id}>
                                    <StrategyCard
                                      strategy={s}
                                      isSelected={selectedStrategy?.id === s.id}
                                      onSelect={() => handleSelectStrategy(s)}
                                      grouped
                                      hideName
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
        </section>

        {/* ── Freebies + 國定假日總覽 ──────────────────────────────── */}
        <div className="mt-2">
          <div className="rounded-2xl border border-green-300 bg-green-50 px-3 pt-1 pb-1">
            {freebies.length > 0 && (
              <>
                <button
                  onClick={() => setShowFreebies(prev => !prev)}
                  aria-expanded={showFreebies}
                  className="w-full flex items-center justify-between py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 rounded-lg"
                >
                  <span className="text-xs text-slate-500">國定連假</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{freebies.length} 個方案</span>
                    <span
                      aria-hidden="true"
                      className={['text-slate-400 text-sm leading-none transition-transform duration-200', showFreebies ? 'rotate-90' : ''].join(' ')}
                    >›</span>
                  </div>
                </button>
                <div className={['grid transition-[grid-template-rows] duration-200 ease-out', showFreebies ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'].join(' ')}>
                  <div className="overflow-hidden min-h-0">
                    <div className="divide-y divide-green-100 pb-1">
                      {freebies.map(s => (
                        <div key={s.id} id={s.id}>
                          <StrategyCard
                            strategy={s}
                            isSelected={selectedStrategy?.id === s.id}
                            showTotalDays
                            onSelect={() => handleSelectStrategy(s)}
                            grouped
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 國定假日總覽 — 固定顯示，無資料的年份呈灰色 */}
            <div className="border-t border-green-200 pt-1 pb-1">
              <div className="flex gap-1">
                {[currentYear, currentYear + 1].map(y => {
                  const hasData = !!ALL_HOLIDAYS[String(y)]
                  return (
                    <button
                      key={y}
                      onClick={() => {
                        if (hasData) {
                          setCalYear(y)
                        } else {
                          setNoDataTip(y)
                          setTimeout(() => setNoDataTip(null), 2500)
                        }
                      }}
                      className={[
                        'flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-lg text-xs transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                        hasData
                          ? 'text-green-700 hover:text-green-900'
                          : 'text-slate-400 cursor-not-allowed',
                      ].join(' ')}
                    >
                      <span className="font-medium">{y} 國定假日總覽</span>
                      <span className={hasData ? 'text-green-400' : 'text-slate-300'}>›</span>
                    </button>
                  )
                })}
              </div>
              <div className={['grid transition-[grid-template-rows] duration-200 ease-out', noDataTip !== null ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'].join(' ')}>
                <div className="overflow-hidden min-h-0">
                  <p className="text-center text-xs text-slate-400 pt-1 pb-0.5">
                    行政院尚未公布 {noDataTip ?? confirmedYears[confirmedYears.length - 1] + 1} 年國定假日，敬請期待
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="py-6 border-t border-slate-100 text-center space-y-1.5">
          <p className="text-xs text-slate-500">
            假期資料來源：
            <a
              href="https://github.com/ruyut/TaiwanCalendar"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-slate-600"
            >
              TaiwanCalendar
            </a>
            （CC BY 4.0）
          </p>
          <p className="text-xs text-slate-500">
            有問題或建議？{' '}
            <a
              href="mailto:vacay.tw@gmail.com"
              className="underline underline-offset-2 hover:text-slate-600 transition-colors"
            >
              vacay.tw@gmail.com
            </a>
          </p>
          <p className="text-xs text-slate-500">© {currentYear} vacay.tw</p>
        </footer>
      </main>

      {/* ── Calendar Bottom Sheet ───────────────────────────────── */}
      <>
        <div
          className={[
            'fixed inset-0 bg-black/40 z-40 transition-opacity duration-300',
            sheetOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
          ].join(' ')}
          onClick={handleCloseSheet}
          aria-hidden="true"
        />

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

          {displayStrategy && (
            <>
              <div className="flex items-center justify-between px-5 py-4 shrink-0">
                <div>
                  <p className="text-base font-bold text-slate-900 leading-tight">
                    {displayStrategy.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {displayStrategy.start} → {displayStrategy.end} · 共 {displayStrategy.totalDays} 天
                  </p>
                </div>
                <button
                  onClick={handleCloseSheet}
                  className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  aria-label="關閉"
                >×</button>
              </div>

              <div className="overflow-y-auto px-5 pb-6 flex-1">
                <Calendar
                  key={displayStrategy.id}
                  month={displayStrategy.start.slice(0, 7)}
                  holidayDates={ALL_HOLIDAY_DATES_FLAT}
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
                  <span aria-live="polite">{shareCopied ? '已複製連結 ✓' : '分享這個方案'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </>

      {/* ── Year Calendar Sheet ─────────────────────────────────── */}
      <YearCalendarSheet
        year={calYear ?? currentYear}
        holidays={ALL_HOLIDAYS[String(calYear ?? currentYear)] ?? []}
        isOpen={calYear !== null}
        onClose={() => setCalYear(null)}
      />

      <Analytics />
    </div>
  )
}
