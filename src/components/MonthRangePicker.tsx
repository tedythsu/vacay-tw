interface Props {
  value: [number, number]   // [startMonth, endMonth], 1-indexed
  onChange: (v: [number, number]) => void
}

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

export function MonthRangePicker({ value, onChange }: Props) {
  const [start, end] = value

  function handleStart(raw: number) {
    onChange([Math.min(raw, end), end])
  }
  function handleEnd(raw: number) {
    onChange([start, Math.max(raw, start)])
  }

  const leftPct  = ((start - 1) / 11) * 100
  const rightPct = ((end   - 1) / 11) * 100

  return (
    <div className="px-1">
      {/* Month labels */}
      <div className="flex justify-between mb-2">
        <span className="text-xs font-medium text-brand-600 tabular-nums">{MONTH_LABELS[start - 1]}</span>
        <span className="text-xs font-medium text-brand-600 tabular-nums">{MONTH_LABELS[end - 1]}</span>
      </div>

      {/* Slider track */}
      <div className="relative h-5 flex items-center">
        {/* Base track */}
        <div className="absolute w-full h-1 bg-slate-200 rounded-full" />
        {/* Filled range */}
        <div
          className="absolute h-1 bg-brand-400 rounded-full"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />

        {/* Start thumb input */}
        <input
          type="range"
          min={1} max={12} step={1}
          value={start}
          onChange={e => handleStart(Number(e.target.value))}
          className="range-thumb absolute w-full appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-brand-500
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:active:cursor-grabbing
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-brand-500
            [&::-moz-range-thumb]:shadow-sm
            [&::-moz-range-thumb]:cursor-grab"
          aria-label="篩選起始月份"
        />

        {/* End thumb input */}
        <input
          type="range"
          min={1} max={12} step={1}
          value={end}
          onChange={e => handleEnd(Number(e.target.value))}
          className="range-thumb absolute w-full appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-brand-500
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:active:cursor-grabbing
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-brand-500
            [&::-moz-range-thumb]:shadow-sm
            [&::-moz-range-thumb]:cursor-grab"
          aria-label="篩選結束月份"
        />
      </div>

      {/* Tick marks */}
      <div className="flex justify-between mt-1.5 px-0">
        {MONTH_LABELS.map((_, i) => (
          <div
            key={i}
            className={[
              'w-px h-1 rounded-full',
              i + 1 >= start && i + 1 <= end ? 'bg-brand-300' : 'bg-slate-200',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}
