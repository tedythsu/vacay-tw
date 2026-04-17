import { useState, useRef } from 'react'

interface Props {
  value: [number, number]   // absolute month positions (months since baseYear Jan, 0-indexed)
  onChange: (v: [number, number]) => void
  minPos: number
  maxPos: number
  baseYear: number
}

function decodeYM(pos: number, baseYear: number): { year: number; month: number } {
  return {
    year: baseYear + Math.floor(pos / 12),
    month: (pos % 12) + 1,
  }
}

function formatYM(pos: number, baseYear: number): string {
  const { year, month } = decodeYM(pos, baseYear)
  return `${year}年${month}月`
}

export function MonthRangePicker({ value, onChange, minPos, maxPos, baseYear }: Props) {
  const [start, end] = value
  const [lastDragged, setLastDragged] = useState<'start' | 'end'>('end')
  const trackRef = useRef<HTMLDivElement>(null)

  const range = maxPos - minPos

  function posFromClientX(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(pct * range) + minPos
  }

  function thumbHandlers(thumb: 'start' | 'end') {
    return {
      onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        e.currentTarget.setPointerCapture(e.pointerId)
        setLastDragged(thumb)
      },
      onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        const pos = posFromClientX(e.clientX)
        if (thumb === 'start') {
          onChange([Math.min(Math.max(pos, minPos), end - 1), end])
        } else {
          onChange([start, Math.max(Math.min(pos, maxPos), start + 1)])
        }
      },
      onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      },
      onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      },
    }
  }

  const leftPct  = ((start - minPos) / range) * 100
  const rightPct = ((end   - minPos) / range) * 100
  const startOnTop = lastDragged === 'start'

  const thumbClass =
    'absolute w-5 h-5 -translate-x-1/2 rounded-full bg-brand-500 shadow-md ' +
    'cursor-grab active:cursor-grabbing active:bg-brand-600 ' +
    'touch-none select-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'

  return (
    <div className="px-1">
      {/* Labels */}
      <div className="flex justify-between mb-2">
        <span className="text-xs font-medium text-brand-600 tabular-nums">{formatYM(start, baseYear)}</span>
        <span className="text-xs font-medium text-brand-600 tabular-nums">{formatYM(end, baseYear)}</span>
      </div>

      {/* Track */}
      <div ref={trackRef} className="relative h-5 flex items-center">
        <div className="absolute w-full h-1 bg-slate-200 rounded-full" />
        <div
          className="absolute h-1 bg-brand-200 rounded-full"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />

        {/* Start thumb */}
        <div
          {...thumbHandlers('start')}
          role="slider"
          aria-label="篩選起始月份"
          aria-valuemin={minPos}
          aria-valuemax={maxPos}
          aria-valuenow={start}
          aria-valuetext={formatYM(start, baseYear)}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') onChange([Math.max(start - 1, minPos), end])
            if (e.key === 'ArrowRight') onChange([Math.min(start + 1, end - 1), end])
          }}
          className={thumbClass}
          style={{ left: `${leftPct}%`, zIndex: startOnTop ? 2 : 1 }}
        />

        {/* End thumb */}
        <div
          {...thumbHandlers('end')}
          role="slider"
          aria-label="篩選結束月份"
          aria-valuemin={minPos}
          aria-valuemax={maxPos}
          aria-valuenow={end}
          aria-valuetext={formatYM(end, baseYear)}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') onChange([start, Math.max(end - 1, start + 1)])
            if (e.key === 'ArrowRight') onChange([start, Math.min(end + 1, maxPos)])
          }}
          className={thumbClass}
          style={{ left: `${rightPct}%`, zIndex: startOnTop ? 1 : 2 }}
        />
      </div>

      {/* Tick marks — January of each year is taller to mark the boundary */}
      <div className="flex justify-between mt-1.5">
        {Array.from({ length: range + 1 }, (_, i) => {
          const pos = minPos + i
          const { month } = decodeYM(pos, baseYear)
          const inRange = pos >= start && pos <= end
          const isJan = month === 1
          return (
            <div
              key={i}
              className={[
                'rounded-full',
                isJan ? 'w-0.5 h-1.5' : 'w-px h-1',
                inRange
                  ? (isJan ? 'bg-brand-400' : 'bg-brand-200')
                  : (isJan ? 'bg-slate-400' : 'bg-slate-200'),
              ].join(' ')}
            />
          )
        })}
      </div>

      {/* "之間" label */}
      <p className="text-sm text-slate-500 text-center mt-2">之間</p>
    </div>
  )
}
