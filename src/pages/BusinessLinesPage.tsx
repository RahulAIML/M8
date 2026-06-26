import { useMemo } from 'react'
import { useLines } from '../api/queries'
import { useDashboardData } from '../hooks/useDashboardData'
import { computeLineStats } from '../lib/analytics'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { useChartColors } from '../lib/chartTheme'
import { TooltipShell, TRow, TTitle, useTooltipColors, type TooltipColors } from '../components/charts/TooltipShell'
import { GitBranch, Users, PlayCircle, BarChart3, CheckCircle2, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'

const COLORS = { accent: '#3B82F6', pass: '#10B981', fail: '#EF4444', violet: '#8B5CF6' }

function LineBarTooltip({ active, payload, label, es, c }: { active?: boolean; payload?: any[]; label?: string; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  return (
    <TooltipShell c={c} minWidth={160}>
      <TTitle text={String(label ?? '')} c={c} />
      {payload.map((p: any) => (
        <TRow key={p.dataKey} label={p.name} value={p.dataKey === 'avgScore' ? `${p.value}%` : p.value} valueStyle={{ color: p.fill }} c={c} />
      ))}
    </TooltipShell>
  )
}

export default function BusinessLinesPage() {
  const language = useAppStore((s) => s.language)
  const t = useTranslation(language)
  const es = language === 'es'
  const c = useChartColors()
  const tt = useTooltipColors()

  const linesQ = useLines()
  const { sims, members, isLoading: dashLoading } = useDashboardData()

  const lineStats = useMemo(() => {
    if (!linesQ.data || !sims.length) return []
    return computeLineStats(linesQ.data, members, sims)
  }, [linesQ.data, members, sims])

  const isLoading = linesQ.isLoading || dashLoading
  const isError = linesQ.isError

  // KPI summary
  const totalLines = lineStats.length
  const activeLines = lineStats.filter((l) => l.simCount > 0).length
  const bestLine = lineStats.find((l) => l.simCount > 0)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5 h-80 skeleton rounded-xl" />
          <div className="card p-5 h-80 skeleton rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-slate-400">{t('error')}</p>
        <button onClick={() => linesQ.refetch()} className="btn-primary">{t('retry')}</button>
      </div>
    )
  }

  if (!lineStats.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_lines_title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('page_lines_subtitle')}</p>
        </div>
        <div className="card p-12 flex flex-col items-center gap-4 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-line/40 flex items-center justify-center">
            <GitBranch className="w-7 h-7 text-slate-500" />
          </div>
          <div>
            <p className="text-slate-300 text-sm font-medium mb-1">
              {es ? 'Sin segmentación por línea' : 'No line segmentation'}
            </p>
            <p className="text-slate-500 text-xs leading-relaxed max-w-sm">
              {es
                ? 'M8 Pharma opera como un equipo unificado sin división por líneas de negocio. Consulta la Vista General o Simulaciones para el análisis completo del equipo.'
                : 'M8 Pharma operates as a unified team without business line segmentation. See Overview or Simulations for full team analytics.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Every line with at least one simulation — never cap the list, the charts
  // grow vertically instead (15 certification lines must all be visible).
  const chartData = lineStats.filter((l) => l.simCount > 0).map((l) => ({
    name: l.name.length > 18 ? l.name.slice(0, 18) + '…' : l.name,
    fullName: l.name,
    simCount: l.simCount,
    avgScore: l.avgScore,
    passRate: l.passRate,
  }))
  // ~30px per bar keeps labels readable regardless of how many lines exist
  const barChartHeight = Math.max(256, chartData.length * 30 + 24)

  const radarData = lineStats.slice(0, 6).map((l) => ({
    line: l.name.length > 12 ? l.name.slice(0, 12) + '…' : l.name,
    avgScore: l.avgScore,
    passRate: l.passRate,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_lines_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_lines_subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">{t('lines_kpi_total')}</p>
              <p className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-base)' }}>{totalLines}</p>
              <p className="text-[11px] text-slate-600 mt-1">{es ? 'líneas registradas' : 'registered lines'}</p>
            </div>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-accent/10 shrink-0 ml-2">
              <GitBranch className="w-4 h-4 text-accent" />
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">{t('lines_kpi_active')}</p>
              <p className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-base)' }}>{activeLines}</p>
              <p className="text-[11px] text-slate-600 mt-1">{es ? 'con simulaciones' : 'with simulations'}</p>
            </div>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-success/10 shrink-0 ml-2">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium mb-1">{t('lines_kpi_best')}</p>
              <p className="text-base sm:text-lg font-bold truncate" style={{ color: 'var(--text-base)' }}>
                {bestLine?.name ?? '—'}
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                {bestLine ? `${bestLine.avgScore}% avg · ${bestLine.passRate}% pass` : '—'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet/10 shrink-0 ml-2">
              <CheckCircle2 className="w-4 h-4 text-violet" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Simulations per line */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            {es ? 'Simulaciones por Línea' : 'Simulations by Line'}
          </h3>
          <div className="overflow-hidden" style={{ height: barChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 'dataMax + 2']} hide />
                <YAxis
                  dataKey="name" type="category" width={120}
                  tick={{ fontSize: 10, fill: c.tick }}
                  tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + '…' : v}
                />
                <Tooltip
                  content={<LineBarTooltip es={es} c={tt} />}
                  wrapperStyle={{ zIndex: 50, outline: 'none' }}
                  cursor={{ fill: c.cursorFill }}
                />
                <Bar dataKey="simCount" name={es ? 'Simulaciones' : 'Simulations'} fill={COLORS.accent} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avg score per line */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            {es ? 'Puntaje Promedio por Línea' : 'Average Score by Line'}
          </h3>
          <div className="overflow-hidden" style={{ height: barChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  dataKey="name" type="category" width={120}
                  tick={{ fontSize: 10, fill: c.tick }}
                  tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + '…' : v}
                />
                <Tooltip
                  content={<LineBarTooltip es={es} c={tt} />}
                  wrapperStyle={{ zIndex: 50, outline: 'none' }}
                  cursor={{ fill: c.cursorFill }}
                />
                <Bar dataKey="avgScore" name={es ? 'Puntaje Promedio' : 'Avg Score'} fill={COLORS.violet} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Radar comparison (top 6 lines) */}
      {radarData.length >= 3 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            {es ? 'Comparación por Línea (Top 6)' : 'Line Comparison (Top 6)'}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke={c.tickMuted} strokeOpacity={0.3} />
                <PolarAngleAxis dataKey="line" tick={{ fontSize: 10, fill: c.tick }} />
                <Radar name={es ? 'Puntaje' : 'Score'} dataKey="avgScore" stroke={COLORS.accent} fill={COLORS.accent} fillOpacity={0.15} strokeWidth={2} />
                <Radar name={es ? 'Aprobación' : 'Pass Rate'} dataKey="passRate" stroke={COLORS.pass} fill={COLORS.pass} fillOpacity={0.1} strokeWidth={2} />
                <Tooltip content={<LineBarTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-accent" />
              {es ? 'Puntaje Promedio' : 'Avg Score'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-success" />
              {es ? 'Tasa Aprobación' : 'Pass Rate'}
            </div>
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line/40">
          <h3 className="text-sm font-semibold text-slate-200">{es ? 'Detalle por Línea' : 'Line Detail'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line/30">
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 whitespace-nowrap">{t('lines_col_name')}</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-3 whitespace-nowrap">{t('lines_col_members')}</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-3 whitespace-nowrap">{t('lines_col_sims')}</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-3 whitespace-nowrap">{t('lines_col_avg')}</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-3 whitespace-nowrap">{t('lines_col_pass')}</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-3 whitespace-nowrap">{t('lines_col_users')}</th>
              </tr>
            </thead>
            <tbody>
              {lineStats.map((line, i) => (
                <tr
                  key={line.id}
                  className={`border-b border-line/20 hover:bg-white/[0.02] transition-colors ${i === 0 ? 'bg-accent/[0.03]' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${line.simCount > 0 ? 'bg-accent' : 'bg-slate-700'}`} />
                      <span className="text-slate-200 font-medium truncate max-w-[180px]">{line.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    <span className="flex items-center justify-end gap-1">
                      <Users className="w-3 h-3 text-slate-600" />
                      {line.memberCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="flex items-center justify-end gap-1">
                      <PlayCircle className="w-3 h-3 text-slate-600" />
                      <span className={line.simCount > 0 ? 'text-slate-300' : 'text-slate-600'}>{line.simCount}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {line.simCount > 0 ? (
                      <span className="flex items-center justify-end gap-1">
                        <BarChart3 className="w-3 h-3 text-slate-600" />
                        <span className={`font-semibold ${
                          line.avgScore >= 80 ? 'text-success' :
                          line.avgScore >= 60 ? 'text-accent' : 'text-danger'
                        }`}>{line.avgScore}%</span>
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {line.simCount > 0 ? (
                      <span className={`font-medium ${
                        line.passRate >= 70 ? 'text-success' :
                        line.passRate >= 50 ? 'text-warning' : 'text-danger'
                      }`}>{line.passRate}%</span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">{line.activeUsers || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
