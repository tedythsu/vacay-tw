import type { Strategy } from '../engine/strategy'

interface Props {
  strategy: Strategy
  isSelected: boolean
  onSelect: () => void
  showTotalDays?: boolean
  grouped?: boolean   // inside a group container — no own border/shadow
  hideName?: boolean  // name already shown as sub-group label above
}

export function StrategyCard({ strategy, isSelected, onSelect, showTotalDays, grouped, hideName }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
        grouped
          ? 'rounded-xl px-2 py-3 hover:bg-slate-50 active:scale-[0.99]'
          : [
              'rounded-2xl p-4 bg-white hover:scale-[1.02] active:scale-[0.99]',
              isSelected
                ? 'border-2 border-brand-500 shadow-md shadow-brand-100'
                : 'border border-slate-200 shadow-sm',
            ].join(' '),
      ].join(' ')}
    >
      {/* Badges */}
      {strategy.isSuperCombo && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
            大禮包
          </span>
        </div>
      )}

      {/* Name */}
      {!hideName && (
        <div className="text-sm font-medium text-slate-800 truncate">
          {strategy.name}
        </div>
      )}

      {/* Date range + totalDays + chevron */}
      <div className="flex items-center justify-between gap-3 mt-1">
        <div className="flex items-baseline gap-3 min-w-0">
          <div className="text-xs text-slate-500 tabular-nums truncate">
            {strategy.start.replace(/-/g, '/')} ～ {strategy.end.replace(/-/g, '/')}
          </div>
          {showTotalDays && (
            <div className="text-sm font-bold text-slate-700 tabular-nums shrink-0">
              連休 {strategy.totalDays} 天
            </div>
          )}
        </div>
        {grouped && (
          <span className="text-slate-400 text-sm shrink-0" aria-hidden="true">›</span>
        )}
      </div>
    </button>
  )
}
