import type { Strategy } from '../engine/strategy'

interface Props {
  strategy: Strategy
  isSelected: boolean
  onSelect: () => void
  isUpsell?: boolean
  isBest?: boolean
}

function cpLabel(cp: number, totalDays: number): { text: string; className: string } {
  // 極高: must be both efficient AND yield a long vacation (≥7 days)
  if (cp >= 2.0 && totalDays >= 7) return { text: '極高', className: 'text-emerald-600' }
  // 高: good efficiency, or long vacation regardless of efficiency
  if (cp >= 1.5 || totalDays >= 10)  return { text: '高',   className: 'text-brand-600' }
  if (cp >= 1.0)                     return { text: '中',   className: 'text-slate-600' }
  return                                    { text: '低',   className: 'text-slate-500' }
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
      {/* Badges — only render when there is something to show */}
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

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm text-slate-500 truncate">{strategy.name}</div>
          <div className="text-lg font-bold text-slate-900 leading-tight tabular-nums">
            休 {strategy.totalDays} 天
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {strategy.start.replace(/-/g, '/')} ～ {strategy.end.replace(/-/g, '/')}
          </div>
        </div>
        {!strategy.isFreebie && (() => {
          const { text, className } = cpLabel(strategy.cpValue!, strategy.totalDays)
          return (
            <div className="text-right shrink-0">
              <div className={`text-xl font-bold leading-none ${isBest ? 'text-amber-500' : className}`}>{text}</div>
              <div className="text-xs text-slate-500 mt-0.5 tracking-wide">CP值</div>
            </div>
          )
        })()}
      </div>

      {/* Stats row — only for non-freebie */}
      {!strategy.isFreebie && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
          <div className="flex-1 text-center">
            <div className="text-sm font-bold text-slate-900 tabular-nums">{strategy.baseDays}</div>
            <div className="text-xs text-slate-500 tracking-wide">天連假</div>
          </div>
          <div className="text-slate-300 font-bold text-sm">+</div>
          <div className="flex-1 text-center">
            <div className="text-sm font-bold text-slate-900 tabular-nums">{strategy.leaveDays}</div>
            <div className="text-xs text-slate-500 tracking-wide">天請假</div>
          </div>
          <div className="text-slate-300 font-bold text-sm">=</div>
          <div className="flex-1 text-center">
            <div className="text-sm font-bold text-slate-900 tabular-nums">{strategy.totalDays}</div>
            <div className="text-xs text-slate-500 tracking-wide">天連休</div>
          </div>
        </div>
      )}
    </button>
  )
}
