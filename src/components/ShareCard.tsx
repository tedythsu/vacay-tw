import { QRCodeSVG } from 'qrcode.react'
import { eachDayOfInterval, parseISO, format } from 'date-fns'
import type { Strategy } from '../engine/strategy'

interface Props {
  strategy: Strategy
}

interface DayBlock {
  date: string
  day: string
  bg: string
  textColor: string
}

function buildDayBlocks(strategy: Strategy): DayBlock[] {
  const holidaySet = new Set(strategy.holidayDates)
  const leaveSet = new Set(strategy.suggestedLeaveDates)
  const weekendSet = new Set(strategy.weekendDates)

  const days = eachDayOfInterval({
    start: parseISO(strategy.start),
    end: parseISO(strategy.end),
  })

  return days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    if (leaveSet.has(dateStr)) {
      return { date: dateStr, day: format(day, 'd'), bg: '#FDE047', textColor: '#713f12' }
    }
    if (holidaySet.has(dateStr)) {
      return { date: dateStr, day: format(day, 'd'), bg: '#FDA4AF', textColor: '#9f1239' }
    }
    if (weekendSet.has(dateStr)) {
      return { date: dateStr, day: format(day, 'd'), bg: '#E2E8F0', textColor: '#64748b' }
    }
    return { date: dateStr, day: format(day, 'd'), bg: '#F8FAFC', textColor: '#94a3b8' }
  })
}

export function ShareCard({ strategy }: Props) {
  const url = `https://vacay.tw/#${strategy.id}`
  const blocks = buildDayBlocks(strategy)

  return (
    <div
      id="share-card-hidden"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        width: '375px',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Microsoft JhengHei", "Noto Sans TC", sans-serif',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>vacay.tw 🏖️</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>台灣最強請假攻略</div>
        </div>
        <QRCodeSVG value={url} size={52} level="M" />
      </div>

      {/* Strategy info */}
      <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
          {strategy.name} · {strategy.year}
          {!strategy.isOfficial && (
            <span style={{ marginLeft: '6px', background: '#fef9c3', color: '#854d0e', borderRadius: '4px', padding: '1px 6px', fontSize: '10px' }}>
              預估
            </span>
          )}
        </div>

        {strategy.isFreebie ? (
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>
            免請假連休 {strategy.totalDays} 天 🎉
          </div>
        ) : (
          <>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              請 {strategy.leaveDays} 天 → 連休 {strategy.totalDays} 天
            </div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#0ea5e9', lineHeight: 1.1 }}>
              CP值 {strategy.cpValue!.toFixed(1)}x
            </div>
          </>
        )}

        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
          {strategy.start.replace(/-/g, '/')} ～ {strategy.end.replace(/-/g, '/')}
        </div>
      </div>

      {/* Day blocks */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
        {blocks.map(block => (
          <div
            key={block.date}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              background: block.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
              color: block.textColor,
            }}
          >
            {block.day}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
        {[
          { color: '#FDA4AF', label: '假日' },
          { color: '#FDE047', label: '請假' },
          { color: '#E2E8F0', label: '週末' },
        ].map(({ color, label }) => (
          <span key={label} style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', background: color, borderRadius: '2px', display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
        vacay.tw | 台灣最強請假攻略
      </div>
    </div>
  )
}
