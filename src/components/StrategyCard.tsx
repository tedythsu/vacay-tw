import type { Strategy } from '../engine/strategy'

interface Props {
  strategy: Strategy
  isSelected: boolean
  onSelect: () => void
}

export function StrategyCard({ strategy, isSelected, onSelect }: Props) {
  const earnedDays = strategy.totalDays - strategy.leaveDays

  return (
    <div
      onClick={onSelect}
      className={[
        'rounded-2xl p-4 cursor-pointer transition-all duration-200',
        'hover:scale-[1.02] active:scale-[0.99]',
        isSelected
          ? 'border-2 border-sky-500 shadow-md shadow-sky-100'
          : 'border border-slate-200 shadow-sm',
        strategy.isFreebie ? 'bg-green-50' : 'bg-white',
      ].join(' ')}
    >
      {/* Badges */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        {!strategy.isOfficial && (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
            預估
          </span>
        )}
        {strategy.isSuperCombo && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
            大禮包 🎁
          </span>
        )}
        {strategy.isFreebie && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            免請假 🎉
          </span>
        )}
      </div>

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 truncate">{strategy.name}</div>
          <div className="text-lg font-extrabold text-slate-900 leading-tight">
            休 {strategy.totalDays} 天
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {strategy.start.replace(/-/g, '/')} ～ {strategy.end.replace(/-/g, '/')}
          </div>
        </div>
        {!strategy.isFreebie && (
          <div className="text-right shrink-0">
            <div className="text-2xl font-extrabold text-sky-500 leading-none">
              {strategy.cpValue!.toFixed(1)}x
            </div>
            <div className="text-xs text-slate-400 mt-0.5">CP值</div>
          </div>
        )}
      </div>

      {/* Stats row — only for non-freebie */}
      {!strategy.isFreebie && (
        <div className="flex gap-2 mt-3">
          <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center">
            <div className="text-sm font-bold text-slate-900">{strategy.leaveDays}</div>
            <div className="text-xs text-slate-400">天請假</div>
          </div>
          <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center">
            <div className="text-sm font-bold text-slate-900">{strategy.totalDays}</div>
            <div className="text-xs text-slate-400">天連休</div>
          </div>
          <div className="flex-1 bg-green-50 rounded-xl p-2 text-center">
            <div className="text-sm font-bold text-green-600">+{earnedDays}</div>
            <div className="text-xs text-slate-400">天賺到</div>
          </div>
        </div>
      )}
    </div>
  )
}
