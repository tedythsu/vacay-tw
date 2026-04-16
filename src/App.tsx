import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { calculateStrategies, getAllHolidayDates } from './engine/strategy'
import { StrategyCard } from './components/StrategyCard'
import { Calendar } from './components/Calendar'
import { AdSlot } from './components/AdSlot'
import type { HolidayEntry } from './engine/strategy'
import holidaysData from './data/holidays.json'

type ListItem =
  | { type: 'strategy'; strategy: ReturnType<typeof calculateStrategies>[number] }
  | { type: 'ad'; key: string }

const ALL_HOLIDAYS = holidaysData as Record<string, HolidayEntry[]>
const confirmedYears = Object.keys(ALL_HOLIDAYS).map(Number).sort()

function yearOfStrategyId(id: string): number | null {
  const m = id.match(/(\d{4})/)
  const y = m ? Number(m[1]) : null
  return y && confirmedYears.includes(y) ? y : null
}

const MIN_BUDGET = 1
const MAX_BUDGET = 7

const today = format(new Date(), 'yyyy-MM-dd')

export default function App() {
  const [selectedYear, setSelectedYear] = useState<number>(confirmedYears[0])
  const [selectedStrategy, setSelectedStrategy] = useState<ReturnType<typeof calculateStrategies>[number] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [showFreebies, setShowFreebies] = useState(false)
  const [showUpsells, setShowUpsells] = useState(false)
  const [showUnderBudget, setShowUnderBudget] = useState(false)
  const [budget, setBudget] = useState(3)
  const [sortBy, setSortBy] = useState<'cp' | 'date' | 'leave' | 'total'>('cp')
  const [shareCopied, setShareCopied] = useState(false)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [cpFilter, setCpFilter] = useState<'all' | 'mid' | 'high' | 'vhigh'>('all')

  const allStrategies = calculateStrategies(selectedYear, ALL_HOLIDAYS[String(selectedYear)] ?? [])
  // Only keep strategies whose end date is today or in the future
  const strategies = allStrategies.filter(s => s.end >= today)

  const allYearHolidayDates = getAllHolidayDates(ALL_HOLIDAYS[String(selectedYear)] ?? [])

  // Lock body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
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
    setShowAll(false)
    setShowFreebies(false)
    setShowUpsells(false)
    setShowUnderBudget(false)
    setCpFilter('all')
    window.history.replaceState(null, '', location.pathname)
  }

  function handleBudgetChange(delta: number) {
    setBudget(prev => Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, prev + delta)))
    setShowAll(false)
    setShowUpsells(false)
    setShowUnderBudget(false)
    setCpFilter('all')
  }

  const DEFAULT_SORT_DIR: Record<typeof sortBy, 'asc' | 'desc'> = {
    cp: 'desc', date: 'asc', leave: 'asc', total: 'desc',
  }

  function handleSortChange(next: typeof sortBy) {
    if (next === sortBy) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(next)
      setSortDir(DEFAULT_SORT_DIR[next])
    }
    setShowAll(false)
  }

  function handleCpFilterChange(next: typeof cpFilter) {
    setCpFilter(next)
    setShowAll(false)
  }

  // Mirrors the cpLabel logic in StrategyCard so filter tiers match displayed labels.
  function matchesCpFilter(s: ReturnType<typeof calculateStrategies>[number]): boolean {
    const cp = s.cpValue ?? 0
    switch (cpFilter) {
      case 'vhigh': return cp >= 2.0 && s.totalDays >= 7
      case 'high':  return cp >= 1.5 || s.totalDays >= 10
      case 'mid':   return cp >= 1.0
      default:      return true
    }
  }

  // ── Budget filtering & sorting ──────────────────────────────────────────────
  const freebies = strategies.filter(s => s.isFreebie)
  const exactBudget = strategies.filter(s =>
    !s.isFreebie && s.leaveDays === budget && matchesCpFilter(s)
  )
  const underBudget = strategies.filter(s =>
    !s.isFreebie && s.leaveDays > 0 && s.leaveDays < budget && matchesCpFilter(s)
  )
  const upsells = strategies.filter(s => {
    if (s.isFreebie || s.leaveDays !== budget + 1) return false
    const cp = s.cpValue ?? 0
    return (cp >= 1.5 || s.totalDays >= 10) && matchesCpFilter(s)
  })

  type S = typeof exactBudget[number]

  // Three-level comparator: cpValue → totalDays (all descending)
  // For exactBudget leaveDays === budget, so adjustedScore = cpValue — no normalisation needed.
  const cpCompareFn = (a: S, b: S): number => {
    const cpDiff = (a.cpValue ?? 0) - (b.cpValue ?? 0)
    if (Math.abs(cpDiff) > 0.0001) return cpDiff
    return a.totalDays - b.totalDays
  }

  // Best strategy: scoped to exactBudget (user asked for N days, badge on best N-day option)
  const bestStrategy = exactBudget.length > 0
    ? exactBudget.reduce((best, s) => cpCompareFn(s, best) > 0 ? s : best)
    : null

  const sortFn = (a: S, b: S) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortBy) {
      case 'date':  return dir * a.start.localeCompare(b.start)
      case 'leave': return dir * (a.leaveDays - b.leaveDays)
      case 'total': return dir * (a.totalDays - b.totalDays)
      case 'cp':
      default:      return dir * cpCompareFn(a, b)
    }
  }

  const paidStrategies = [...exactBudget].sort(sortFn)
  const underBudgetStrategies = [...underBudget].sort(sortFn)
  const upsellStrategies = [...upsells].sort(sortFn)

  const INITIAL_SHOW = 5

  const allPaidItems: ListItem[] = []
  paidStrategies.forEach((s, i) => {
    allPaidItems.push({ type: 'strategy', strategy: s })
    if (i === 0 || i === 2) {
      allPaidItems.push({ type: 'ad', key: `ad-${i}` })
    }
  })

  const paidItems: ListItem[] = showAll ? allPaidItems : (() => {
    const result: ListItem[] = []
    let count = 0
    for (const item of allPaidItems) {
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
            vacay.tw
          </h1>
          <p className="text-sm text-slate-500 mt-1">台灣請假攻略</p>
        </header>

        {/* ── Year Tabs (only when multiple confirmed years) ───────── */}
        {confirmedYears.length > 1 && (
          <div role="tablist" className="flex border-b-2 border-slate-100 mb-4">
            {confirmedYears.map(year => (
              <button
                key={year}
                role="tab"
                aria-selected={selectedYear === year}
                onClick={() => handleYearChange(year)}
                className={[
                  'flex-1 py-3 text-sm font-semibold transition-colors',
                  selectedYear === year
                    ? 'text-sky-500 border-b-2 border-sky-500 -mb-[2px]'
                    : 'text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {year}
              </button>
            ))}
          </div>
        )}

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
          <span className="text-sm text-slate-500">天假，幫我找最佳方案</span>
        </div>

        {/* ── CP Filter Pills ─────────────────────────────────────── */}
        <div className="mb-3">
          <p className="text-xs text-slate-400 mb-1.5">CP值篩選</p>
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {([
              { key: 'all',   label: '全部' },
              { key: 'mid',   label: '中以上' },
              { key: 'high',  label: '高以上' },
              { key: 'vhigh', label: '極高' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleCpFilterChange(key)}
                className={[
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  cpFilter === key
                    ? 'bg-sky-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-500',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sort Pills ──────────────────────────────────────────── */}
        <div className="mb-3">
          <p className="text-xs text-slate-400 mb-1.5">排序方式</p>
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {([
              { key: 'cp',    label: 'CP值' },
              { key: 'date',  label: '日期' },
              { key: 'leave', label: '請假天數' },
              { key: 'total', label: '連休天數' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSortChange(key)}
                className={[
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1',
                  sortBy === key
                    ? 'bg-sky-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-500',
                ].join(' ')}
              >
                {label}
                {sortBy === key && (
                  <span className="text-[10px] leading-none">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Paid Strategy List ──────────────────────────────────── */}
        <div className="space-y-3 pb-2">
          {paidItems.map(item =>
            item.type === 'ad' ? (
              <AdSlot key={item.key} />
            ) : (
              <div key={item.strategy.id} id={item.strategy.id}>
                <StrategyCard
                  strategy={item.strategy}
                  isSelected={selectedStrategy?.id === item.strategy.id}
                  isUpsell={false}
                  isBest={bestStrategy !== null && cpCompareFn(item.strategy, bestStrategy) === 0}
                  onSelect={() => handleSelectStrategy(item.strategy)}
                />
              </div>
            )
          )}
        </div>

        {/* Show more button */}
        {!showAll && paidStrategies.length > INITIAL_SHOW && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-3 text-sm text-slate-500 hover:text-sky-500 border border-dashed border-slate-200 rounded-2xl transition-colors mt-1 mb-2"
          >
            顯示全部 {paidStrategies.length} 個方案 ↓
          </button>
        )}

        {/* ── Under-budget (collapsible) ──────────────────────────── */}
        {underBudgetStrategies.length > 0 && (
          <div className="mt-2 mb-2">
            <button
              onClick={() => setShowUnderBudget(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span className="font-medium">少於 {budget} 天的方案（{underBudgetStrategies.length} 個）</span>
              <span className={['text-slate-400 transition-transform duration-200', showUnderBudget ? 'rotate-180' : ''].join(' ')}>
                ▾
              </span>
            </button>
            {showUnderBudget && (
              <div className="space-y-3 mt-2">
                {underBudgetStrategies.map(s => (
                  <div key={s.id} id={s.id}>
                    <StrategyCard
                      strategy={s}
                      isSelected={selectedStrategy?.id === s.id}
                      isUpsell={false}
                      isBest={false}
                      onSelect={() => handleSelectStrategy(s)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Upsells (collapsible) ────────────────────────────────── */}
        {upsellStrategies.length > 0 && (
          <div className="mt-2 mb-2">
            <button
              onClick={() => setShowUpsells(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-dashed border-orange-200 rounded-2xl text-sm text-slate-600 hover:bg-orange-50 transition-colors"
            >
              <span className="font-medium">建議加碼（{upsellStrategies.length} 個）</span>
              <span className={['text-slate-400 transition-transform duration-200', showUpsells ? 'rotate-180' : ''].join(' ')}>
                ▾
              </span>
            </button>
            {showUpsells && (
              <div className="space-y-3 mt-2">
                {upsellStrategies.map(s => (
                  <div key={s.id} id={s.id}>
                    <StrategyCard
                      strategy={s}
                      isSelected={selectedStrategy?.id === s.id}
                      isUpsell={true}
                      isBest={false}
                      onSelect={() => handleSelectStrategy(s)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Freebies (collapsible) ───────────────────────────────── */}
        {freebies.length > 0 && (
          <div className="mt-2 mb-2">
            <button
              onClick={() => setShowFreebies(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span className="font-medium">免請假連假（{freebies.length} 個）</span>
              <span className={['text-slate-400 transition-transform duration-200', showFreebies ? 'rotate-180' : ''].join(' ')}>
                ▾
              </span>
            </button>
            {showFreebies && (
              <div className="space-y-3 mt-2">
                {freebies.map(s => (
                  <div key={s.id} id={s.id}>
                    <StrategyCard
                      strategy={s}
                      isSelected={selectedStrategy?.id === s.id}
                      isUpsell={false}
                      onSelect={() => handleSelectStrategy(s)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="py-6 border-t border-slate-100 text-center space-y-1">
          <p className="text-xs text-slate-400">
            正式請假請依行政院人事行政總處公告為準。
          </p>
          <p className="text-xs text-slate-300">© {new Date().getFullYear()} vacay.tw</p>
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
                  const url = `${location.origin}${location.pathname}#${selectedStrategy.id}`
                  if (navigator.share) {
                    await navigator.share({ title: selectedStrategy.name, url })
                  } else {
                    await navigator.clipboard.writeText(url)
                    setShareCopied(true)
                    setTimeout(() => setShareCopied(false), 2000)
                  }
                }}
                className="w-full mt-4 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-xl py-3.5 font-semibold text-sm transition-colors"
              >
                {shareCopied ? '已複製連結 ✓' : '分享這個攻略'}
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
