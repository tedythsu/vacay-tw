import { useRef, useEffect, useMemo } from 'react'
import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  isWeekend,
  parseISO,
} from 'date-fns'
import type { HolidayEntry } from '../engine/strategy'

interface Props {
  year: number
  holidays: HolidayEntry[]
  isOpen: boolean
  onClose: () => void
}

const MONTH_NAMES = [
  '1 月', '2 月', '3 月', '4 月', '5 月', '6 月',
  '7 月', '8 月', '9 月', '10 月', '11 月', '12 月',
]
const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function MiniMonth({
  year, month, holidaySet, makeupSet,
}: {
  year: number
  month: number   // 0-indexed
  holidaySet: Set<string>
  makeupSet: Set<string>
}) {
  const monthStart = startOfMonth(new Date(year, month, 1))
  const monthEnd   = endOfMonth(monthStart)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd     = endOfWeek(monthEnd,    { weekStartsOn: 0 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })

  function cellClass(dateStr: string, inMonth: boolean, day: Date): string {
    const base = 'text-center text-[11px] py-[3px] leading-none'
    if (!inMonth)               return `${base} text-slate-200`
    if (holidaySet.has(dateStr)) return `${base} bg-red-100 text-red-600 font-bold rounded`
    if (makeupSet.has(dateStr))  return `${base} bg-amber-100 text-amber-700 font-bold rounded`
    if (isWeekend(day))          return `${base} text-slate-400`
    return `${base} text-slate-700`
  }

  return (
    <div>
      <div className="text-xs font-bold text-slate-800 mb-1.5 tabular-nums">
        {MONTH_NAMES[month]}
      </div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] text-slate-400 leading-none py-0.5">
            {d}
          </div>
        ))}
      </div>
      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, monthStart)
          return (
            <div key={dateStr} className={cellClass(dateStr, inMonth, day)}>
              {inMonth ? format(day, 'd') : ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function YearCalendarSheet({ year, holidays, isOpen, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Build date sets for colour-coding
  const holidaySet = useMemo(() => {
    const s = new Set<string>()
    for (const h of holidays) {
      if (h.type !== 'holiday') continue
      for (const d of eachDayOfInterval({ start: parseISO(h.start), end: parseISO(h.end) })) {
        s.add(format(d, 'yyyy-MM-dd'))
      }
    }
    return s
  }, [holidays])

  const makeupSet = useMemo(() => {
    const s = new Set<string>()
    for (const h of holidays) {
      if (h.type === 'makeup_work') s.add(h.start)
    }
    return s
  }, [holidays])

  const makeupHolidays = holidays.filter(h => h.type === 'makeup_work')
  const nationalHolidays = holidays.filter(h => h.type === 'holiday')

  // Focus management
  useEffect(() => {
    if (isOpen) sheetRef.current?.focus()
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 bg-black/40 z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${year} 年假日總覽`}
        className={[
          'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50',
          'bg-white rounded-t-3xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          'max-h-[92vh] flex flex-col focus-visible:outline-none',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div>
            <p className="text-base font-bold text-slate-900">{year} 國定假日總覽</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {nationalHolidays.length} 個國定假日
              {makeupHolidays.length > 0 && `・${makeupHolidays.length} 個補班日`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 pb-8 flex-1">

          {/* 12-month grid */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-6">
            {Array.from({ length: 12 }, (_, i) => (
              <MiniMonth
                key={i}
                year={year}
                month={i}
                holidaySet={holidaySet}
                makeupSet={makeupSet}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-6 pt-4 border-t border-slate-100">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 bg-red-100 rounded inline-block" aria-hidden="true" />
              國定假日
            </span>
            {makeupSet.size > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-3 h-3 bg-amber-100 rounded inline-block" aria-hidden="true" />
                補班日
              </span>
            )}
          </div>

          {/* Holiday list */}
          <div className="mt-5 space-y-0">
            {nationalHolidays.map(h => (
              <div key={h.start} className="flex items-baseline justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-800 font-medium">{h.name}</span>
                <span className="text-xs text-slate-500 tabular-nums ml-4 shrink-0">
                  {h.start === h.end
                    ? h.start.replace(/-/g, '/')
                    : `${h.start.replace(/-/g, '/')} ～ ${h.end.replace(/-/g, '/')}`}
                </span>
              </div>
            ))}

            {makeupHolidays.length > 0 && (
              <>
                <div className="pt-4 pb-1">
                  <span className="text-xs font-semibold text-slate-400 tracking-wide">補班日</span>
                </div>
                {makeupHolidays.map(h => (
                  <div key={h.start} className="flex items-baseline justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-800 font-medium">{h.name}</span>
                    <span className="text-xs text-slate-500 tabular-nums ml-4 shrink-0">
                      {h.start.replace(/-/g, '/')}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
