import type { Strategy } from '../engine/strategy'

interface Props {
  strategy: Strategy
  isSelected: boolean
  onSelect: () => void
  showTotalDays?: boolean   // for freebie cards rendered outside grouped list
}

export function StrategyCard({ strategy, isSelected, onSelect, showTotalDays }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left rounded-2xl p-4 transition-all duration-200',
        'hover:scale-[1.02] active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        isSelected
          ? 'border-2 border-brand-500 shadow-md shadow-brand-100'
          : 'border border-slate-200 shadow-sm',
        strategy.isFreebie ? 'bg-green-50' : 'bg-white',
      ].join(' ')}
    >
      {/* Badges */}
      {strategy.isSuperCombo && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
            大禮包
          </span>
        </div>
      )}

      {/* Name */}
      <div className="text-sm font-medium text-slate-800 truncate">
        {strategy.name}
      </div>

      {/* Date range + totalDays for standalone cards */}
      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className="text-xs text-slate-500 tabular-nums">
          {strategy.start.replace(/-/g, '/')} ～ {strategy.end.replace(/-/g, '/')}
        </div>
        {showTotalDays && (
          <div className="text-sm font-bold text-slate-700 tabular-nums shrink-0">
            連休 {strategy.totalDays} 天
          </div>
        )}
      </div>
    </button>
  )
}
