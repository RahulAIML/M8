import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { DateRangeFilter } from '../components/ui/DateRangeFilter'
import { CheckCircle2, XCircle, TrendingUp, Activity, Award, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { useChartColors } from '../lib/chartTheme'
import { TooltipShell, TRow, TTitle, useTooltipColors, type TooltipColors } from '../components/charts/TooltipShell'
import { PASS_THRESHOLD } from '../lib/analytics'
import { cn } from '../lib/cn'

const PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

function ActivityBarTooltip({ active, payload, es, c }: { active?: boolean; payload?: any[]; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <TooltipShell c={c} minWidth={200}>
      <TTitle text={d.fullName ?? d.name} c={c} />
      <TRow label={es ? 'Sesiones' : 'Sessions'}        value={d.count}           valueStyle={{ color: d.color }}   c={c} />
      <TRow label={es ? 'Puntaje Prom.' : 'Avg Score'}  value={`${d.avgScore}%`}  valueStyle={{ color: c.accent }}  c={c} />
      <TRow label={es ? 'Aprobación' : 'Pass Rate'}     value={`${d.passRate}%`}  valueStyle={{ color: '#10b981' }} c={c} />
    </TooltipShell>
  )
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = value >= PASS_THRESHOLD ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative h-1.5 bg-surface rounded-full overflow-hidden w-full">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
      {PASS_THRESHOLD < max && (
        <div
          className="absolute inset-y-0 w-px bg-slate-500/50"
          style={{ left: `${PASS_THRESHOLD}%` }}
        />
      )}
    </div>
  )
}

export default function ActivitiesPage() {
  const language     = useAppStore((s) => s.language)
  const dateFrom     = useAppStore((s) => s.dateFrom)
  const dateTo       = useAppStore((s) => s.dateTo)
  const setDateRange = useAppStore((s) => s.setDateRange)
  const t  = useTranslation(language)
  const c  = useChartColors()
  const tt = useTooltipColors()
  const es = language === 'es'
  const { simsLoading, activitiesLoading, isError, actStats, refetch } = useDashboardData()
  const isLoading = simsLoading || activitiesLoading

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-40 skeleton rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
        </div>
        <div className="card p-5 h-80 skeleton rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-slate-400">{t('error')}</p>
        <button onClick={refetch} className="btn-primary">{t('retry')}</button>
      </div>
    )
  }

  const stats = actStats ?? []

  const totalSessions = stats.reduce((s, a) => s + a.count, 0)
  const totalPass     = stats.reduce((s, a) => s + a.passCount, 0)
  const totalFail     = stats.reduce((s, a) => s + a.failCount, 0)
  const overallAvg    = totalSessions > 0
    ? Math.round(stats.reduce((s, a) => s + a.avgScore * a.count, 0) / totalSessions)
    : 0
  const overallPassRate = totalSessions > 0 ? Math.round((totalPass / totalSessions) * 100) : 0

  const chartData = stats.map((a, i) => ({
    name:     a.name.length > 22 ? a.name.slice(0, 22) + '…' : a.name,
    fullName: a.name,
    count:    a.count,
    avgScore: a.avgScore,
    passRate: a.passRate,
    color:    PALETTE[i % PALETTE.length],
  }))

  const SUMMARY_CHIPS = [
    {
      icon: BarChart2,
      label: es ? 'Total Sesiones' : 'Total Sessions',
      value: totalSessions,
      sub:   `${stats.length} ${es ? 'ejercicios' : 'exercises'}`,
      accent: 'text-accent',
    },
    {
      icon: TrendingUp,
      label: es ? 'Puntaje Promedio' : 'Avg Score',
      value: `${overallAvg}%`,
      sub:   es ? `umbral ${PASS_THRESHOLD}%` : `threshold ${PASS_THRESHOLD}%`,
      accent: overallAvg >= PASS_THRESHOLD ? 'text-success' : 'text-danger',
    },
    {
      icon: CheckCircle2,
      label: es ? 'Aprobación Global' : 'Overall Pass Rate',
      value: `${overallPassRate}%`,
      sub:   `${totalPass} ${es ? 'aprobados' : 'passed'}`,
      accent: 'text-success',
    },
    {
      icon: Award,
      label: es ? 'Mejor Ejercicio' : 'Top Exercise',
      value: stats.length ? `${Math.max(...stats.map((a) => a.passRate))}%` : '—',
      sub:   stats.length
        ? (stats.reduce((best, a) => a.passRate > best.passRate ? a : best, stats[0]).name.slice(0, 20))
        : '—',
      accent: 'text-amber-400',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_act_title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('page_act_subtitle')}</p>
        </div>
        <DateRangeFilter
          from={dateFrom ?? ''} to={dateTo ?? ''}
          onApply={(f, to_) => setDateRange(f || null, to_ || null)}
        />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SUMMARY_CHIPS.map(({ icon: Icon, label, value, sub, accent }) => (
          <div key={label} className="card p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <Icon className={cn('w-3.5 h-3.5', accent)} />
              {label}
            </div>
            <p className={cn('text-2xl font-bold tabular-nums', accent)}>{value}</p>
            <p className="text-[11px] text-slate-600 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* Bar chart — sessions per exercise */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">{t('activity_breakdown')}</h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {es ? 'Sesiones completadas por ejercicio en el período' : 'Sessions completed per exercise in the period'}
            </p>
          </div>
        </div>
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 44 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b' }}
                angle={-28}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                content={<ActivityBarTooltip es={es} c={tt} />}
                wrapperStyle={{ zIndex: 50, outline: 'none' }}
                cursor={{ fill: c.cursorFill }}
              />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} barSize={28}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pass-rate chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              {es ? 'Tasa de Aprobación por Ejercicio' : 'Pass Rate by Exercise'}
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {es ? `Línea de referencia en ${PASS_THRESHOLD}%` : `Reference line at ${PASS_THRESHOLD}%`}
            </p>
          </div>
        </div>
        <div className="h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 44 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b' }}
                angle={-28}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip
                content={<ActivityBarTooltip es={es} c={tt} />}
                wrapperStyle={{ zIndex: 50, outline: 'none' }}
                cursor={{ fill: c.cursorFill }}
              />
              <ReferenceLine
                y={PASS_THRESHOLD}
                stroke="#10b981"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: `${PASS_THRESHOLD}%`, fill: '#10b981', fontSize: 10, position: 'insideTopRight' }}
              />
              <Bar dataKey="passRate" radius={[5, 5, 0, 0]} barSize={28}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.passRate >= PASS_THRESHOLD ? '#10b981' : entry.passRate >= 50 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Exercise cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map((a, i) => (
          <div key={a.id} className="card p-5 card-interactive space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${PALETTE[i % PALETTE.length]}18` }}>
                <Activity className="w-4 h-4" style={{ color: PALETTE[i % PALETTE.length] }} />
              </div>
              <span className="text-[10px] text-slate-600 bg-surface border border-line/30 px-2 py-0.5 rounded-full">{a.activityType}</span>
            </div>

            <h4 className="text-sm font-semibold text-slate-100 line-clamp-2 leading-snug">{a.name}</h4>

            {/* Score bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">{es ? 'Puntaje Prom.' : 'Avg Score'}</span>
                <span className={cn('font-semibold', a.avgScore >= PASS_THRESHOLD ? 'text-success' : 'text-danger')}>
                  {a.avgScore}%
                </span>
              </div>
              <ScoreBar value={a.avgScore} />
            </div>

            {/* Pass rate bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">{es ? 'Aprobación' : 'Pass Rate'}</span>
                <span className={cn('font-semibold', a.passRate >= PASS_THRESHOLD ? 'text-success' : 'text-danger')}>
                  {a.passRate}%
                </span>
              </div>
              <ScoreBar value={a.passRate} />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-line/20">
              <div>
                <p className="text-base font-bold text-slate-100 tabular-nums">{a.count}</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mt-0.5">{t('col_simulations')}</p>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-0.5 text-success text-sm font-semibold tabular-nums">
                  <CheckCircle2 className="w-3 h-3" />{a.passCount}
                </span>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">{es ? 'Aprobados' : 'Passed'}</p>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-0.5 text-danger text-sm font-semibold tabular-nums">
                  <XCircle className="w-3 h-3" />{a.failCount}
                </span>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">{es ? 'Reprobados' : 'Failed'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.length === 0 && (
        <div className="card p-12 text-center">
          <Activity className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{t('no_data')}</p>
        </div>
      )}
    </div>
  )
}
