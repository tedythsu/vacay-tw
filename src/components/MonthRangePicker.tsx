import { useState, useRef } from 'react'

interface Props {
  value: [number, number]   // [startMonth, endMonth], 1-indexed
  onChange: (v: [number, number]) => void
  minStart?: number         // minimum allowed start month (default 1)
}

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

export function MonthRangePicker({ value, onChange, minStart = 1 }: Props) {
  const [start, end] = value
  const [lastDragged, setLastDragged] = useState<'start' | 'end'>('end')
  const trackRef = useRef<HTMLDivElement>(null)

  function monthFromClientX(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(pct * 11) + 1
  }

  // Returns pointer event handlers for a given thumb using setPointerCapture —
  // this guarantees the dragging thumb keeps receiving pointermove even when the
  // pointer leaves the element, and works identically on mouse and touch.
  function thumbHandlers(thumb: 'start' | 'end') {
    return {
      onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        e.currentTarget.setPointerCapture(e.pointerId)
        setLastDragged(thumb)
      },
      onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        const month = monthFromClientX(e.clientX)
        if (thumb === 'start') {
          onChange([Math.min(Math.max(month, minStart), end - 1), end])
        } else {
          onChange([start, Math.max(month, start + 1)])
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

  const leftPct  = ((start - 1) / 11) * 100
  const rightPct = ((end   - 1) / 11) * 100

  // Last dragged thumb sits on top (purely cosmetic, thumbs never overlap)
  const startOnTop = lastDragged === 'start'

  const thumbClass =
    'absolute w-5 h-5 -translate-x-1/2 rounded-full bg-brand-500 shadow-md ' +
    'cursor-grab active:cursor-grabbing active:bg-brand-600 ' +
    'touch-none select-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'

  return (
    <div className="px-1">
      {/* Month labels */}
      <div className="flex justify-between mb-2">
        <span className="text-xs font-medium text-brand-600 tabular-nums">{MONTH_LABELS[start - 1]}</span>
        <span className="text-xs font-medium text-brand-600 tabular-nums">{MONTH_LABELS[end - 1]}</span>
      </div>

      {/* Slider track */}
      <div ref={trackRef} className="relative h-5 flex items-center">
        {/* Base track */}
        <div className="absolute w-full h-1 bg-slate-200 rounded-full" />
        {/* Filled range */}
        <div
          className="absolute h-1 bg-brand-200 rounded-full"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />

        {/* Start thumb */}
        <div
          {...thumbHandlers('start')}
          role="slider"
          aria-label="篩選起始月份"
          aria-valuemin={minStart}
          aria-valuemax={12}
          aria-valuenow={start}
          aria-valuetext={MONTH_LABELS[start - 1]}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') onChange([Math.max(start - 1, minStart), end])
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
          aria-valuemin={1}
          aria-valuemax={12}
          aria-valuenow={end}
          aria-valuetext={MONTH_LABELS[end - 1]}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') onChange([start, Math.max(end - 1, start + 1)])
            if (e.key === 'ArrowRight') onChange([start, Math.min(end + 1, 12)])
          }}
          className={thumbClass}
          style={{ left: `${rightPct}%`, zIndex: startOnTop ? 1 : 2 }}
        />
      </div>

      {/* Tick marks */}
      <div className="flex justify-between mt-1.5 px-0">
        {MONTH_LABELS.map((_, i) => (
          <div
            key={i}
            className={[
              'w-px h-1 rounded-full',
              i + 1 >= start && i + 1 <= end ? 'bg-brand-200' : 'bg-slate-200',
            ].join(' ')}
          />
        ))}
      </div>

      {/* "之間" label */}
      <p className="text-xs text-slate-400 text-center mt-2">之間</p>
    </div>
  )
}
