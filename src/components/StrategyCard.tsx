import type { Strategy } from '../engine/strategy'

interface Props {
  strategy: Strategy
  isSelected: boolean
  onSelect: () => void
  isUpsell?: boolean
  isBest?: boolean
}

export function StrategyCard({ strategy, isSelected, onSelect, isUpsell, isBest }: Props) {
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
          : isBest
            ? 'border-2 border-amber-400 shadow-md shadow-amber-100'
            : isUpsell
              ? 'border border-dashed border-orange-200 shadow-sm'
              : 'border border-slate-200 shadow-sm',
        isBest ? 'bg-amber-50' : strategy.isFreebie ? 'bg-green-50' : 'bg-white',
      ].join(' ')}
    >
      {/* Badges */}
      {(isBest || strategy.isSuperCombo) && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {isBest && (
            <span className="text-xs bg-amber-400 text-white px-2 py-0.5 rounded-full font-semibold">
              ★ 最佳方案
            </span>
          )}
          {strategy.isSuperCombo && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              大禮包
            </span>
          )}
        </div>
      )}

      {/* Name + context */}
      <div className="text-sm text-slate-600 truncate">
        {strategy.name}
        {!strategy.isFreebie && (
          <span className="text-slate-500"> · {strategy.baseDays}天連假</span>
        )}
      </div>

      {/* Hero + date — single flex row, baseline-aligned */}
      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className="text-2xl font-bold text-slate-900 leading-tight tabular-nums">
          連休 {strategy.totalDays} 天
        </div>
        <div className="text-xs text-slate-500 tabular-nums shrink-0">
          {strategy.start.replace(/-/g, '/')} ～ {strategy.end.replace(/-/g, '/')}
        </div>
      </div>
    </button>
  )
}
