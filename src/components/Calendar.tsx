import { useState, useEffect, useMemo } from 'react'
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  isWeekend,
} from 'date-fns'

interface Props {
  month: string          // "2027-02" — initial month to display
  holidayDates: string[]
  leaveDates: string[]
  weekendDates: string[]
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function Calendar({ month, holidayDates, leaveDates, weekendDates }: Props) {
  const [current, setCurrent] = useState(() => new Date(month + '-01T00:00:00'))

  useEffect(() => {
    setCurrent(new Date(month + '-01T00:00:00'))
  }, [month])

  const holidaySet = useMemo(() => new Set(holidayDates), [holidayDates])
  const leaveSet = useMemo(() => new Set(leaveDates), [leaveDates])
  const weekendSet = useMemo(() => new Set(weekendDates), [weekendDates])

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  function dayClasses(dateStr: string, inMonth: boolean): string {
    const base = 'text-center text-xs py-1.5 rounded-lg transition-colors tabular-nums'
    if (!inMonth) return `${base} text-slate-300`
    if (holidaySet.has(dateStr)) return `${base} bg-red-100 text-red-600 font-bold`
    if (leaveSet.has(dateStr)) return `${base} bg-amber-100 text-amber-700 font-bold`
    if (weekendSet.has(dateStr)) return `${base} bg-slate-100 text-slate-500`
    if (isWeekend(new Date(dateStr + 'T00:00:00'))) return `${base} text-slate-300`
    return `${base} text-slate-700`
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrent(prev => subMonths(prev, 1))}
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
          aria-label="上個月"
        >
          ‹
        </button>
        <span className="text-sm font-bold text-slate-900 tabular-nums">
          {format(current, 'yyyy 年 M 月')}
        </span>
        <button
          onClick={() => setCurrent(prev => addMonths(prev, 1))}
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
          aria-label="下個月"
        >
          ›
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs text-slate-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, current)
          return (
            <div key={dateStr} className={dayClasses(dateStr, inMonth)}>
              {format(day, 'd')}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-6 flex-wrap">
        {[
          { color: 'bg-red-100', label: '國定假日' },
          { color: 'bg-amber-100', label: '建議請假' },
          { color: 'bg-slate-100', label: '週末' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-3 h-3 ${color} rounded inline-block`} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
