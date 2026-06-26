import { useState, useEffect } from 'react'
import { Calendar, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { DATA_EPOCH } from '../../lib/dateUtils'
import { useAppStore } from '../../store'
import { useTranslation } from '../../lib/i18n'

interface Props {
  from: string
  to: string
  onApply: (from: string, to: string) => void
  label?: string
  className?: string
}

type Preset = { label: string; days?: number; months?: number }
const PRESETS: Preset[] = [
  { label: 'All' },
  { label: '7D',  days: 7 },
  { label: '15D', days: 15 },
  { label: '3M',  months: 3 },
  { label: '6M',  months: 6 },
  { label: '12M', months: 12 },
]

export function DateRangeFilter({ from, to, onApply, label, className }: Props) {
  const language = useAppStore((s) => s.language)
  const t = useTranslation(language)
  const [pendingFrom, setPendingFrom] = useState(from)
  const [pendingTo,   setPendingTo]   = useState(to)

  // Keep pending in sync when parent commits a new applied value
  useEffect(() => setPendingFrom(from), [from])
  useEffect(() => setPendingTo(to),     [to])

  const isPending = pendingFrom !== from || pendingTo !== to
  const isActive  = !!(from || to)

  function applyPreset(p: Preset) {
    const today = new Date().toISOString().slice(0, 10)
    if (!p.days && !p.months) { onApply(DATA_EPOCH, today); return }
    const past = new Date()
    if (p.months) past.setMonth(past.getMonth() - p.months)
    else if (p.days) past.setDate(past.getDate() - p.days)
    onApply(past.toISOString().slice(0, 10), today)
  }

  const inputCls = cn(
    'bg-surface text-slate-300 text-xs rounded-lg px-1.5 py-1.5 focus:outline-none cursor-pointer min-w-0 w-[120px] transition-colors border',
    isPending ? 'border-amber-500/60' : isActive ? 'border-accent/60' : 'border-line',
  )

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {label && (
        <span className="flex items-center gap-1 text-xs text-slate-500 mr-0.5">
          <Calendar className="w-3.5 h-3.5" />
          {label}
        </span>
      )}

      {/* Preset buttons */}
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => applyPreset(p)}
          className="text-[11px] px-2 py-1 rounded border border-line/50 text-slate-500 hover:text-slate-200 hover:border-line transition-colors leading-none"
        >
          {p.label}
        </button>
      ))}

      {/* Custom date inputs */}
      <input type="date" value={pendingFrom} onChange={(e) => setPendingFrom(e.target.value)} className={inputCls} />
      <span className="text-xs text-slate-600">—</span>
      <input type="date" value={pendingTo}   onChange={(e) => setPendingTo(e.target.value)}   className={inputCls} />

      {/* Aplicar — visible while pending */}
      {isPending && (
        <button
          onClick={() => onApply(pendingFrom, pendingTo)}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/40 text-accent hover:bg-accent/20 transition-colors leading-none"
        >
          {t('filter_apply')} ✓
        </button>
      )}

      {/* Clear — visible when active and not pending */}
      {isActive && !isPending && (
        <button
          onClick={() => onApply('', '')}
          title="Clear dates"
          className="p-1 rounded-md text-slate-500 hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// Returns true if isoDate (YYYY-MM-DD) is within [from, to] (inclusive)
export function inDateRange(isoDate: string, from: string, to: string): boolean {
  if (!isoDate || isoDate === 'unknown') return false
  if (from && isoDate < from) return false
  if (to   && isoDate > to)   return false
  return true
}
