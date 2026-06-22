import { memo } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

type Variant = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'indigo'

interface Props {
  label: string
  value: string | number
  sublabel?: string
  icon: LucideIcon
  variant?: Variant
  delta?: number
  suffix?: string
  className?: string
  index?: number
}

export const KPICard = memo(function KPICard({
  label,
  value,
  sublabel,
  icon: Icon,
  delta,
  suffix,
  className,
  index = 0,
}: Props) {
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col gap-3 kpi-card-in',
        className,
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header row: label left, icon circle right */}
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-slate-500 leading-tight">{label}</p>
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-accent" />
        </div>
      </div>

      {/* Big number */}
      <div>
        <span className="text-3xl font-bold text-slate-800">
          {value}
          {suffix && <span className="text-xl text-slate-400 ml-0.5">{suffix}</span>}
        </span>
      </div>

      {/* Delta / sub-label row */}
      {(delta !== undefined || sublabel) && (
        <div className="flex items-center gap-2 -mt-1">
          {delta !== undefined && (
            <span className={cn(
              'text-xs font-medium flex items-center gap-0.5',
              delta >= 0 ? 'text-emerald-600' : 'text-danger',
            )}>
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% {sublabel ? '' : 'vs previous month'}
            </span>
          )}
          {sublabel && !delta && (
            <p className="text-xs text-slate-400 leading-relaxed">{sublabel}</p>
          )}
        </div>
      )}
    </div>
  )
})
