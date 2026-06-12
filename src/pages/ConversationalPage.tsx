import { memo, useMemo, useState } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { useObjections } from '../api/queries'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { MessageSquare, BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Activity, Target, ArrowUpDown } from 'lucide-react'
import { useChartColors } from '../lib/chartTheme'
import { TooltipShell, TRow, TTitle, useTooltipColors, type TooltipColors } from '../components/charts/TooltipShell'
import type { ActivityStat } from '../lib/analytics'

// ─── Tooltip ────────────────────────────────────────────────────────────────
function RoundTooltip({
  active, payload, label, es, c,
}: {
  active?: boolean; payload?: any[]; label?: string; es: boolean; c: TooltipColors
}) {
  if (!active || !payload?.length) return null
  return (
    <TooltipShell c={c} minWidth={180}>
      <TTitle text={String(label ?? '')} c={c} />
      {payload.map((p: any) => (
        <TRow
          key={p.dataKey}
          label={p.dataKey === 'avg'
            ? (es ? 'Puntaje Prom.' : 'Avg Score')
            : (es ? 'Tasa Aprobación' : 'Pass Rate')}
          value={`${p.value}%`}
          valueStyle={{ color: p.stroke ?? p.fill }}
          c={c}
        />
      ))}
    </TooltipShell>
  )
}

// ─── Legend renderer ─────────────────────────────────────────────────────────
function renderLegend(props: any) {
  const { payload } = props
  if (!payload?.length) return null
  return (
    <div className="flex gap-4 justify-center mt-2">
      {payload.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: entry.color }} />
          <span className="text-[11px] text-slate-500">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Performance tier logic ───────────────────────────────────────────────────
type Tier = 'strong' | 'developing' | 'needs-attention'

function getTier(stat: ActivityStat): Tier {
  if (stat.passRate >= 65 && stat.avgScore >= 65) return 'strong'
  if (stat.passRate >= 40 || stat.avgScore >= 50)  return 'developing'
  return 'needs-attention'
}

function TierBadge({ tier, es }: { tier: Tier; es: boolean }) {
  const cfg = {
    'strong':          { label: es ? 'Sólido'           : 'Strong',          cls: 'bg-success/10 text-success border-success/20',       Icon: CheckCircle },
    'developing':      { label: es ? 'En desarrollo'    : 'Developing',      cls: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20', Icon: Minus },
    'needs-attention': { label: es ? 'Requiere atención': 'Needs Attention',  cls: 'bg-danger/10 text-danger border-danger/20',            Icon: AlertTriangle },
  }[tier]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function getFeedbackLine(stat: ActivityStat, es: boolean): string {
  const { passRate, avgScore, count } = stat
  if (es) {
    if (passRate >= 65 && avgScore >= 65)
      return `Rendimiento consistente con ${passRate}% de aprobación en ${count} simulaciones.`
    if (passRate >= 65 && avgScore < 65)
      return `Alta tasa de aprobación (${passRate}%) pero puntaje promedio bajo (${avgScore}%). Revisar profundidad de respuestas.`
    if (passRate < 65 && avgScore >= 65)
      return `Buen puntaje promedio (${avgScore}%) pero solo ${passRate}% aprobaron. Revisar criterio de corte.`
    if (passRate >= 40)
      return `Rendimiento mixto (${passRate}% aprobación, ${avgScore}% puntaje). Oportunidad de mejora estructurada.`
    return `Bajo rendimiento: ${passRate}% aprobación y ${avgScore}% puntaje en ${count} simulaciones. Intervención urgente recomendada.`
  } else {
    if (passRate >= 65 && avgScore >= 65)
      return `Consistent performance with ${passRate}% pass rate across ${count} simulations.`
    if (passRate >= 65 && avgScore < 65)
      return `High pass rate (${passRate}%) but low avg score (${avgScore}%). Review response depth.`
    if (passRate < 65 && avgScore >= 65)
      return `Good avg score (${avgScore}%) but only ${passRate}% passed. Review pass threshold.`
    if (passRate >= 40)
      return `Mixed results — ${passRate}% pass rate, ${avgScore}% avg score. Structured improvement opportunity.`
    return `Low performance: ${passRate}% pass rate and ${avgScore}% avg score across ${count} simulations. Urgent intervention recommended.`
  }
}

function TrendIcon({ passRate }: { passRate: number }) {
  if (passRate >= 65) return <TrendingUp   className="w-4 h-4 text-success" />
  if (passRate >= 40) return <Minus         className="w-4 h-4 text-yellow-400" />
  return                      <TrendingDown  className="w-4 h-4 text-danger" />
}

// ─── Simulator card ───────────────────────────────────────────────────────────
const SimulatorCard = memo(function SimulatorCard({ stat, rank, es }: { stat: ActivityStat; rank: number; es: boolean }) {
  const tier = getTier(stat)
  const feedback = getFeedbackLine(stat, es)

  return (
    <div className="card p-4 flex flex-col gap-3 hover:border-line/50 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 text-accent text-[10px] font-bold flex items-center justify-center">
            {rank}
          </span>
          <p className="text-[12px] font-semibold text-slate-200 leading-snug line-clamp-2">
            {stat.name}
          </p>
        </div>
        <TierBadge tier={tier} es={es} />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white/[0.03] rounded-lg p-2">
          <p className="text-[18px] font-bold text-slate-100 tabular-nums leading-none">
            {stat.avgScore}
            <span className="text-[11px] text-slate-500 font-normal">%</span>
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">{es ? 'Prom.' : 'Avg'}</p>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-2">
          <p className={`text-[18px] font-bold tabular-nums leading-none ${
            stat.passRate >= 65 ? 'text-success' : stat.passRate >= 40 ? 'text-yellow-400' : 'text-danger'
          }`}>
            {stat.passRate}
            <span className="text-[11px] font-normal text-slate-500">%</span>
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">{es ? 'Aprobac.' : 'Pass'}</p>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-2">
          <p className="text-[18px] font-bold text-slate-100 tabular-nums leading-none">
            {stat.count}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">{es ? 'Sims.' : 'Sims'}</p>
        </div>
      </div>

      {/* Pass bar */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-600 mb-1">
          <span>{stat.passCount} {es ? 'aprobaron' : 'passed'}</span>
          <span>{stat.failCount} {es ? 'fallaron' : 'failed'}</span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              stat.passRate >= 65 ? 'bg-success' : stat.passRate >= 40 ? 'bg-yellow-400' : 'bg-danger'
            }`}
            style={{ width: `${stat.passRate}%` }}
          />
        </div>
      </div>

      {/* Feedback line */}
      <div className="flex items-start gap-1.5 pt-0.5 border-t border-line/20">
        <TrendIcon passRate={stat.passRate} />
        <p className="text-[11px] text-slate-500 leading-snug">{feedback}</p>
      </div>
    </div>
  )
})

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ConversationalPage() {
  const language  = useAppStore((s) => s.language)
  const dateFrom  = useAppStore((s) => s.dateFrom)
  const dateTo    = useAppStore((s) => s.dateTo)
  const t = useTranslation(language)
  const c  = useChartColors()
  const tt = useTooltipColors()
  const es = language === 'es'

  const { simsLoading, activitiesLoading, isError, roundStats, actStats, refetch } = useDashboardData()
  const objQ = useObjections(dateFrom, dateTo)
  const isLoading = simsLoading || activitiesLoading

  const [objSortAsc, setObjSortAsc] = useState(true)  // true = worst first (ascending pass_rate)

  // ── ALL hooks BEFORE any conditional return (Rules of Hooks) ─────────────────
  const stats    = roundStats ?? []
  const simStats = useMemo(
    () => (actStats ?? []).slice().sort((a, b) => b.passRate - a.passRate),
    [actStats],
  )

  const avgKey  = es ? 'Puntaje Prom.'   : 'Avg Score'
  const passKey = es ? 'Tasa Aprobación' : 'Pass Rate'

  const radarData = useMemo(
    () => stats.map((r) => ({
      round: `${t('round')} ${r.round}`,
      [avgKey]:  r.avg,
      [passKey]: r.passRate,
    })),
    // t is stable across renders of same language — string key lookup is pure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, avgKey, passKey],
  )

  // Summary stats from simulators
  const totalSims   = simStats.reduce((s, a) => s + a.count, 0)
  const overallAvg  = simStats.length && totalSims
    ? Math.round(simStats.reduce((s, a) => s + a.avgScore * a.count, 0) / totalSims)
    : 0
  const strongCount = simStats.filter((a) => getTier(a) === 'strong').length
  const attnCount   = simStats.filter((a) => getTier(a) === 'needs-attention').length

  // Objection stats — name lookup from actStats
  const actNameById = useMemo(
    () => new Map((actStats ?? []).map((a) => [a.id, a.name])),
    [actStats],
  )
  const objStats = useMemo(() => {
    const raw = objQ.data ?? []
    return objSortAsc
      ? raw.slice().sort((a, b) => a.pass_rate - b.pass_rate)   // worst first
      : raw.slice().sort((a, b) => b.pass_rate - a.pass_rate)   // best first
  }, [objQ.data, objSortAsc])
  // ── End of hook declarations ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5 h-80 skeleton rounded-xl" />
          <div className="card p-5 h-80 skeleton rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 h-52 skeleton rounded-xl" />
          ))}
        </div>
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

  if (!stats.length && !simStats.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_conv_title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('page_conv_subtitle')}</p>
        </div>
        <div className="card p-10 flex flex-col items-center gap-3">
          <MessageSquare className="w-12 h-12 text-slate-600" />
          <p className="text-slate-400 text-sm">{t('no_data')}</p>
        </div>
      </div>
    )
  }

  // overallPass only used in the JSX below — derived here (no hook, plain var)
  const overallPass = simStats.length && totalSims
    ? Math.round(simStats.reduce((s, a) => s + a.passCount, 0) / totalSims * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_conv_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_conv_subtitle')}</p>
      </div>

      {/* Summary chips */}
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] text-slate-400 bg-card border border-line/30 px-3 py-1 rounded-full">
            {stats.length} {es ? 'interacciones activas' : 'active interactions'}
          </span>
          <span className="text-[11px] text-accent bg-accent/5 border border-accent/20 px-3 py-1 rounded-full">
            {es ? 'Prom. puntos: ' : 'Avg score: '}
            {Math.round(stats.reduce((s, r) => s + r.avg, 0) / stats.length * 100) / 100}
          </span>
          <span className="text-[11px] text-success bg-success/5 border border-success/20 px-3 py-1 rounded-full">
            {es ? 'Prom. aprobación: ' : 'Avg pass rate: '}
            {Math.round(stats.reduce((s, r) => s + r.passRate, 0) / stats.length)}%
          </span>
        </div>
      )}

      {/* Charts — only when interaction-level data exists */}
      {stats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Radar */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-slate-200">
                {es ? 'Perfil de Interacciones' : 'Interaction Profile'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-600 mb-4">
              {es ? 'Forma del rendimiento por interacción' : 'Performance shape across interactions'}
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="round" tick={{ fontSize: 11, fill: c.tick }} />
                  <PolarRadiusAxis domain={[0, 100]} tickCount={4} tick={{ fontSize: 9, fill: c.tick }} axisLine={false} />
                  <Radar name={avgKey}  dataKey={avgKey}  stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} strokeWidth={2} />
                  <Radar name={passKey} dataKey={passKey} stroke="#10B981" fill="#10B981" fillOpacity={0.15} strokeWidth={2} />
                  <Tooltip content={<RoundTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} />
                  <Legend content={renderLegend} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="w-4 h-4 text-violet" />
              <h3 className="text-sm font-semibold text-slate-200">
                {es ? 'Puntuación por Interacción' : 'Score by Interaction'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-600 mb-4">
              {es ? 'Puntaje promedio y tasa de aprobación por paso' : 'Avg score and pass rate per step'}
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={radarData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barCategoryGap="25%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="round" tick={{ fontSize: 11, fill: c.tick }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: c.tick }} axisLine={false} tickLine={false} />
                  <Tooltip content={<RoundTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ fill: c.cursorFill }} />
                  <Legend content={renderLegend} />
                  <Bar dataKey={avgKey}  fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey={passKey} fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Per-interaction detail table */}
      {stats.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            {es ? 'Detalle por Interacción' : 'Interaction Detail'}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line/30 text-left">
                  <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4">
                    {es ? 'Interacción' : 'Interaction'}
                  </th>
                  <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4 text-right">
                    {es ? 'Evaluaciones' : 'Evaluations'}
                  </th>
                  <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4 text-right">
                    {es ? 'Puntaje Prom.' : 'Avg Score'}
                  </th>
                  <th className="pb-2 text-[11px] font-medium text-slate-600 text-right">
                    {es ? 'Tasa Aprobación' : 'Pass Rate'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/20">
                {stats.map((r) => (
                  <tr key={r.round} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-slate-200">
                      {t('round')} {r.round}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400 text-right tabular-nums">
                      {r.count.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <span className={`font-semibold ${r.avg >= 0.7 ? 'text-success' : r.avg >= 0.4 ? 'text-yellow-400' : 'text-danger'}`}>
                        {r.avg}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        r.passRate >= 60
                          ? 'bg-success/10 text-success'
                          : r.passRate >= 40
                            ? 'bg-yellow-400/10 text-yellow-400'
                            : 'bg-danger/10 text-danger'
                      }`}>
                        {r.passRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Objection Handling Analysis ─────────────────────────────────── */}
      {(objStats.length > 0 || objQ.isLoading) && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  {es ? 'Manejo de Objeciones' : 'Objection Handling'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {es
                    ? 'Tasa de éxito por tipo de objeción del médico'
                    : 'Success rate per doctor objection type'}
                </p>
              </div>
            </div>
            {objStats.length > 0 && (
              <button
                onClick={() => setObjSortAsc((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-line/50 text-slate-400 hover:text-slate-200 hover:border-line transition-colors self-start sm:self-auto"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {objSortAsc
                  ? (es ? 'Peores primero' : 'Worst first')
                  : (es ? 'Mejores primero' : 'Best first')}
              </button>
            )}
          </div>

          {objQ.isLoading ? (
            <div className="card p-5 h-48 skeleton rounded-xl" />
          ) : (
            <div className="card p-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px] text-sm">
                  <thead>
                    <tr className="border-b border-line/30 text-left">
                      <th className="pb-2 text-[11px] font-medium text-slate-600 pr-3 w-8">#</th>
                      <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4">
                        {es ? 'Objeción del Médico' : 'Doctor Objection'}
                      </th>
                      <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4">
                        {es ? 'Simulador' : 'Simulator'}
                      </th>
                      <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4 text-right">
                        {es ? 'Veces' : 'Times'}
                      </th>
                      <th className="pb-2 text-[11px] font-medium text-slate-600 text-right">
                        {es ? 'Tasa de Éxito' : 'Success Rate'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/20">
                    {objStats.map((obj, idx) => {
                      const rate = obj.pass_rate
                      const color = rate >= 70 ? 'text-success' : rate >= 40 ? 'text-yellow-400' : 'text-danger'
                      const barColor = rate >= 70 ? 'bg-success' : rate >= 40 ? 'bg-yellow-400' : 'bg-danger'
                      const simName = actNameById.get(obj.usecase_id) ?? `#${obj.usecase_id}`
                      return (
                        <tr key={`${obj.usecase_id}|${obj.objection_text}`} className="hover:bg-white/[0.015] transition-colors">
                          <td className="py-2.5 pr-3 text-slate-600 text-[11px] tabular-nums">{idx + 1}</td>
                          <td className="py-2.5 pr-4 text-slate-300 text-[12px] max-w-[280px]">
                            <span className="line-clamp-2 leading-snug">{obj.objection_text}</span>
                          </td>
                          <td className="py-2.5 pr-4 text-slate-500 text-[11px] max-w-[160px]">
                            <span className="line-clamp-1">{simName}</span>
                          </td>
                          <td className="py-2.5 pr-4 text-slate-400 text-right tabular-nums text-[12px]">
                            {obj.count}
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${rate}%` }} />
                              </div>
                              <span className={`tabular-nums text-[12px] font-semibold w-9 text-right ${color}`}>
                                {rate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {objStats.length > 0 && (
                <p className="text-[10px] text-slate-600 mt-3">
                  {es
                    ? `${objStats.length} objeciones únicas · Las tasas de éxito bajas indican donde enfocar el coaching`
                    : `${objStats.length} unique objections · Low success rates indicate where to focus coaching`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Simulator Performance Feedback ──────────────────────────────── */}
      {simStats.length > 0 && (
        <div className="space-y-4">

          {/* Section header + aggregate chips */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  {es ? 'Desempeño por Simulador' : 'Simulator Performance Overview'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {es
                    ? `${simStats.length} simuladores · ${totalSims.toLocaleString()} simulaciones totales`
                    : `${simStats.length} simulators · ${totalSims.toLocaleString()} total simulations`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[11px] text-accent bg-accent/5 border border-accent/20 px-3 py-1 rounded-full">
                {es ? 'Prom. global: ' : 'Overall avg: '}{overallAvg}%
              </span>
              <span className={`text-[11px] px-3 py-1 rounded-full border ${
                strongCount > 0 ? 'text-success bg-success/5 border-success/20' : 'text-slate-500 bg-card border-line/30'
              }`}>
                {strongCount} {es ? 'sólidos' : 'strong'}
              </span>
              {attnCount > 0 && (
                <span className="text-[11px] text-danger bg-danger/5 border border-danger/20 px-3 py-1 rounded-full">
                  {attnCount} {es ? 'requieren atención' : 'need attention'}
                </span>
              )}
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {simStats.map((stat, idx) => (
              <SimulatorCard key={stat.id} stat={stat} rank={idx + 1} es={es} />
            ))}
          </div>

          {/* Summary table */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">
              {es ? 'Resumen Comparativo de Simuladores' : 'Simulator Comparison Summary'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line/30 text-left">
                    <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4">#</th>
                    <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4">
                      {es ? 'Simulador' : 'Simulator'}
                    </th>
                    <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4 text-right">
                      {es ? 'Sims.' : 'Sims'}
                    </th>
                    <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4 text-right">
                      {es ? 'Puntaje Prom.' : 'Avg Score'}
                    </th>
                    <th className="pb-2 text-[11px] font-medium text-slate-600 pr-4 text-right hidden sm:table-cell">
                      {es ? 'Tasa Aprobación' : 'Pass Rate'}
                    </th>
                    <th className="pb-2 text-[11px] font-medium text-slate-600 text-right">
                      {es ? 'Estado' : 'Status'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/20">
                  {simStats.map((stat, idx) => (
                    <tr key={stat.id} className="hover:bg-white/[0.015] transition-colors">
                      <td className="py-2.5 pr-4 text-slate-600 text-[11px] tabular-nums">{idx + 1}</td>
                      <td className="py-2.5 pr-4 font-medium text-slate-200 max-w-[240px]">
                        <span className="line-clamp-1 text-[12px]">{stat.name}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-400 text-right tabular-nums text-[12px]">
                        {stat.count.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        <span className={`font-semibold text-[12px] ${
                          stat.avgScore >= 65 ? 'text-success' : stat.avgScore >= 45 ? 'text-yellow-400' : 'text-danger'
                        }`}>
                          {stat.avgScore}%
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right hidden sm:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                stat.passRate >= 65 ? 'bg-success' : stat.passRate >= 40 ? 'bg-yellow-400' : 'bg-danger'
                              }`}
                              style={{ width: `${stat.passRate}%` }}
                            />
                          </div>
                          <span className={`tabular-nums text-[12px] font-semibold w-9 text-right ${
                            stat.passRate >= 65 ? 'text-success' : stat.passRate >= 40 ? 'text-yellow-400' : 'text-danger'
                          }`}>
                            {stat.passRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <TierBadge tier={getTier(stat)} es={es} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
