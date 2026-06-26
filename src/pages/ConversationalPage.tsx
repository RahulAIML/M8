import { memo, useMemo, useState } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { useConversationStats, useObjections } from '../api/queries'
import type { SessionDepthRow } from '../api/types'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import {
  MessageSquare, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle, Activity, Target, ArrowUpDown, Layers, Zap,
} from 'lucide-react'
import { useChartColors } from '../lib/chartTheme'
import { TooltipShell, TRow, TTitle, useTooltipColors, type TooltipColors } from '../components/charts/TooltipShell'
import { cn } from '../lib/cn'
import type { ActivityStat } from '../lib/analytics'

// ─── Derived analytics from raw depth rows ───────────────────────────────────

interface ExerciseDepthStat {
  sim_id: number
  sim_name: string
  sessions: number
  avg_turns: number
  min_turns: number
  max_turns: number
  total_turns: number
}

interface FunnelPoint {
  turn: number
  pct: number
  sessions: number
}

function computeDepthAnalytics(rows: SessionDepthRow[]) {
  if (!rows.length) return { exerciseStats: [], funnel: [], maxTurn: 0, totalSessions: 0 }

  const totalSessions = rows.length
  const byExercise = new Map<number, SessionDepthRow[]>()
  for (const r of rows) {
    const list = byExercise.get(r.sim_id) ?? []
    list.push(r)
    byExercise.set(r.sim_id, list)
  }

  const exerciseStats: ExerciseDepthStat[] = []
  for (const [sim_id, group] of byExercise) {
    const counts = group.map((r) => Number(r.turn_count))
    exerciseStats.push({
      sim_id,
      sim_name: group[0].sim_name,
      sessions: group.length,
      avg_turns: Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10,
      min_turns: Math.min(...counts),
      max_turns: Math.max(...counts),
      total_turns: counts.reduce((a, b) => a + b, 0),
    })
  }

  const maxTurn = Math.max(...rows.map((r) => Number(r.turn_count)))
  const funnel: FunnelPoint[] = []
  for (let n = 1; n <= maxTurn; n++) {
    const sessions = rows.filter((r) => Number(r.turn_count) >= n).length
    funnel.push({ turn: n, sessions, pct: Math.round((sessions / totalSessions) * 100) })
  }

  return { exerciseStats, funnel, maxTurn, totalSessions }
}

// ─── Tooltip components ───────────────────────────────────────────────────────

function FunnelTooltip({ active, payload, label, es, c }: { active?: boolean; payload?: any[]; label?: string; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as FunnelPoint
  return (
    <TooltipShell c={c} minWidth={160}>
      <TTitle text={`${es ? 'Turno' : 'Turn'} ${label}`} c={c} />
      <TRow label={es ? 'Sesiones' : 'Sessions'} value={d.sessions} c={c} />
      <TRow label={es ? 'Alcance' : 'Reach'} value={`${d.pct}%`} valueStyle={{ color: '#3B82F6' }} c={c} />
    </TooltipShell>
  )
}

function RoundTooltip({ active, payload, label, es, c }: { active?: boolean; payload?: any[]; label?: string; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  return (
    <TooltipShell c={c} minWidth={180}>
      <TTitle text={String(label ?? '')} c={c} />
      {payload.map((p: any) => (
        <TRow key={p.dataKey} label={p.name} value={`${p.value}%`} valueStyle={{ color: p.stroke ?? p.fill }} c={c} />
      ))}
    </TooltipShell>
  )
}

// ─── Performance tier ─────────────────────────────────────────────────────────

type Tier = 'strong' | 'developing' | 'needs-attention'

function getTier(stat: ActivityStat): Tier {
  if (stat.passRate >= 65 && stat.avgScore >= 65) return 'strong'
  if (stat.passRate >= 40 || stat.avgScore >= 50) return 'developing'
  return 'needs-attention'
}

const TIER_CFG = {
  'strong':          { label: { es: 'Sólido',            en: 'Strong' },          cls: 'bg-success/10 text-success border-success/20',        Icon: CheckCircle },
  'developing':      { label: { es: 'En desarrollo',     en: 'Developing' },      cls: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20', Icon: Minus },
  'needs-attention': { label: { es: 'Requiere atención', en: 'Needs Attention' }, cls: 'bg-danger/10 text-danger border-danger/20',             Icon: AlertTriangle },
}

function TierBadge({ tier, es }: { tier: Tier; es: boolean }) {
  const cfg = TIER_CFG[tier]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label[es ? 'es' : 'en']}
    </span>
  )
}

// ─── KPI chip ────────────────────────────────────────────────────────────────

function KPIChip({ value, label, sub, accent = false }: { value: string | number; label: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn(
      'flex-1 min-w-[130px] rounded-xl border px-4 py-3',
      accent
        ? 'bg-accent/5 border-accent/25'
        : 'bg-surface/60 border-line/40',
    )}>
      <p className={cn('text-2xl font-bold tabular-nums tracking-tight', accent ? 'text-accent' : 'text-slate-100')}>
        {value}
      </p>
      <p className="text-[11px] font-medium text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Simulator card ───────────────────────────────────────────────────────────

const SimulatorCard = memo(function SimulatorCard({ stat, rank, es }: { stat: ActivityStat; rank: number; es: boolean }) {
  const tier = getTier(stat)

  return (
    <div className="card p-4 flex flex-col gap-3 hover:border-line/60 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 text-accent text-[10px] font-bold flex items-center justify-center">
            {rank}
          </span>
          <p className="text-[12px] font-semibold text-slate-200 leading-snug line-clamp-2">{stat.name}</p>
        </div>
        <TierBadge tier={tier} es={es} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { val: `${stat.avgScore}%`, lbl: es ? 'Prom.' : 'Avg', color: stat.avgScore >= 65 ? 'text-success' : stat.avgScore >= 45 ? 'text-yellow-400' : 'text-danger' },
          { val: `${stat.passRate}%`, lbl: es ? 'Aprob.' : 'Pass', color: stat.passRate >= 65 ? 'text-success' : stat.passRate >= 40 ? 'text-yellow-400' : 'text-danger' },
          { val: stat.count, lbl: es ? 'Sims.' : 'Sims', color: 'text-slate-100' },
        ].map(({ val, lbl, color }) => (
          <div key={lbl} className="bg-white/[0.03] rounded-lg p-2">
            <p className={`text-[17px] font-bold tabular-nums leading-none ${color}`}>{val}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{lbl}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-slate-600 mb-1">
          <span>{stat.passCount} {es ? 'aprobaron' : 'passed'}</span>
          <span>{stat.failCount} {es ? 'fallaron' : 'failed'}</span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-[width] duration-700',
              stat.passRate >= 65 ? 'bg-success' : stat.passRate >= 40 ? 'bg-yellow-400' : 'bg-danger')}
            style={{ width: `${stat.passRate}%` }}
          />
        </div>
      </div>
    </div>
  )
})

// ─── Drop-off insight card ────────────────────────────────────────────────────

function DropOffInsight({ funnel, es }: { funnel: FunnelPoint[]; es: boolean }) {
  if (funnel.length < 2) return null
  let biggestDrop = 0, dropTurn = 0
  for (let i = 1; i < funnel.length; i++) {
    const drop = funnel[i - 1].pct - funnel[i].pct
    if (drop > biggestDrop) { biggestDrop = drop; dropTurn = funnel[i].turn }
  }
  if (!dropTurn) return null
  const before = funnel[dropTurn - 2]
  const after  = funnel[dropTurn - 1]

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-amber-300">{es ? 'Caída principal detectada' : 'Key drop-off detected'}</span>
      </div>
      <p className="text-[12px] text-slate-400 leading-relaxed">
        {es
          ? `Entre el turno ${before.turn} y el turno ${after.turn}, el ${before.pct}% de sesiones cae al ${after.pct}% — una pérdida de ${biggestDrop} puntos porcentuales. Enfoca el coaching en mantener a los asesores comprometidos más allá del turno ${before.turn}.`
          : `Between turn ${before.turn} and turn ${after.turn}, ${before.pct}% of sessions drops to ${after.pct}% — a ${biggestDrop}pp fall. Focus coaching on keeping advisors engaged past turn ${before.turn}.`}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConversationalPage() {
  const language = useAppStore((s) => s.language)
  const dateFrom = useAppStore((s) => s.dateFrom)
  const dateTo   = useAppStore((s) => s.dateTo)
  const t   = useTranslation(language)
  const c   = useChartColors()
  const tt  = useTooltipColors()
  const es  = language === 'es'

  const { simsLoading, activitiesLoading, isError, actStats, refetch } = useDashboardData()
  const depthQ = useConversationStats(dateFrom, dateTo)
  const objQ   = useObjections(dateFrom, dateTo)

  const [objSortAsc, setObjSortAsc] = useState(true)

  const simStats = useMemo(
    () => (actStats ?? []).slice().sort((a, b) => b.passRate - a.passRate),
    [actStats],
  )

  const { exerciseStats, funnel, totalSessions } = useMemo(
    () => computeDepthAnalytics(depthQ.data ?? []),
    [depthQ.data],
  )

  const avgDepth = useMemo(() => {
    if (!exerciseStats.length) return 0
    const total = exerciseStats.reduce((s, e) => s + e.total_turns, 0)
    const sess  = exerciseStats.reduce((s, e) => s + e.sessions, 0)
    return sess ? Math.round((total / sess) * 10) / 10 : 0
  }, [exerciseStats])

  const engagementT5 = funnel[4]?.pct ?? 0   // % reaching turn 5
  const deepSessions = funnel[9]              // turn 10+

  const objStats = useMemo(() => {
    const raw = objQ.data ?? []
    return objSortAsc
      ? raw.slice().sort((a, b) => a.pass_rate - b.pass_rate)
      : raw.slice().sort((a, b) => b.pass_rate - a.pass_rate)
  }, [objQ.data, objSortAsc])

  const actNameById = useMemo(
    () => new Map((actStats ?? []).map((a) => [a.id, a.name])),
    [actStats],
  )

  const avgKey  = es ? 'Puntaje Prom.' : 'Avg Score'
  const passKey = es ? 'Tasa Aprobación' : 'Pass Rate'

  const isLoading = simsLoading || activitiesLoading || depthQ.isLoading

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-56 skeleton rounded-lg" />
        <div className="flex gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="flex-1 h-20 skeleton rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card h-72 skeleton rounded-xl" />
          <div className="card h-72 skeleton rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="card h-44 skeleton rounded-xl" />)}
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

  return (
    <div className="space-y-6 page-fade">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_conv_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_conv_subtitle')}</p>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      {totalSessions > 0 && (
        <div className="flex flex-wrap gap-3">
          <KPIChip value={totalSessions} label={t('conv_kpi_sessions')} accent />
          <KPIChip value={`${avgDepth}`} label={t('conv_kpi_avg_depth')} sub={t('conv_kpi_turns')} />
          <KPIChip value={`${engagementT5}%`} label={t('conv_kpi_engagement')} />
          {deepSessions && (
            <KPIChip value={`${deepSessions.sessions}`} label={t('conv_kpi_deep')} sub={t('conv_kpi_deep_sub')} />
          )}
        </div>
      )}

      {/* ── Funnel + Drop-off ───────────────────────────────────────────────── */}
      {funnel.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Funnel area chart — 2/3 width */}
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-slate-200">{t('conv_funnel_title')}</h3>
            </div>
            <p className="text-[11px] text-slate-600 mb-4">{t('conv_funnel_sub')}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={funnel} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="turn"
                    tick={{ fontSize: 10, fill: c.tick }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: t('conv_funnel_x'), position: 'insideBottom', offset: -2, fontSize: 10, fill: c.tick }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: c.tick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<FunnelTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '4 2' }} />
                  {/* Reference line at the big drop (turn 9→10) */}
                  {funnel.length >= 10 && (
                    <ReferenceLine
                      x={10}
                      stroke="#F59E0B"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      label={{ value: es ? 'Caída' : 'Drop', position: 'top', fontSize: 9, fill: '#F59E0B' }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="pct"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#funnelGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Drop-off insight + depth summary — 1/3 width */}
          <div className="flex flex-col gap-4">
            <DropOffInsight funnel={funnel} es={es} />

            <div className="card p-4 flex-1">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('conv_depth_title')}</h4>
              <div className="space-y-3">
                {exerciseStats.map((ex) => {
                  const barPct = Math.round((ex.avg_turns / Math.max(...exerciseStats.map((e) => e.max_turns))) * 100)
                  return (
                    <div key={ex.sim_id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-slate-300 truncate max-w-[160px]">
                          {ex.sim_name.replace(/^M8\s*-?\s*/i, '').replace(/^Coach\s+Certificador\s+M8\s+Pharma\s+/i, 'Coach ').replace(/^Simulador\s+Visita\s+Medica\s+M8\s+/i, 'Sim ')}
                        </span>
                        <span className="text-[11px] font-semibold text-accent tabular-nums shrink-0 ml-2">{ex.avg_turns} {t('conv_kpi_turns')}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-accent/60 rounded-full transition-[width] duration-700" style={{ width: `${barPct}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                        <span>{ex.sessions} {t('conv_depth_sessions').toLowerCase()}</span>
                        <span>{ex.min_turns}–{ex.max_turns} {t('conv_kpi_turns')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Objection Handling ──────────────────────────────────────────────── */}
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
                  {es ? 'Tasa de éxito por tipo de objeción del médico' : 'Success rate per doctor objection type'}
                </p>
              </div>
            </div>
            {objStats.length > 0 && (
              <button
                onClick={() => setObjSortAsc((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-line/50 text-slate-400 hover:text-slate-200 hover:border-line transition-colors self-start sm:self-auto"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {objSortAsc ? (es ? 'Peores primero' : 'Worst first') : (es ? 'Mejores primero' : 'Best first')}
              </button>
            )}
          </div>
          {objQ.isLoading ? (
            <div className="card p-5 h-48 skeleton rounded-xl" />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line/30 text-left">
                      <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{es ? 'Objeción' : 'Objection'}</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{es ? 'Simulador' : 'Simulator'}</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">{es ? 'Veces' : 'Times'}</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">{es ? 'Tasa de Éxito' : 'Success Rate'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/20">
                    {objStats.map((obj, idx) => {
                      const rate = obj.pass_rate
                      const color = rate >= 70 ? 'text-success' : rate >= 40 ? 'text-yellow-400' : 'text-danger'
                      const barColor = rate >= 70 ? 'bg-success' : rate >= 40 ? 'bg-yellow-400' : 'bg-danger'
                      return (
                        <tr key={`${obj.usecase_id}|${obj.objection_text}`} className="hover:bg-white/[0.015] transition-colors">
                          <td className="px-4 py-2.5 text-slate-600 text-[11px] tabular-nums">{idx + 1}</td>
                          <td className="px-4 py-2.5 text-slate-300 text-[12px] max-w-[280px]">
                            <span className="line-clamp-2 leading-snug">{obj.objection_text}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 text-[11px] max-w-[180px]">
                            <span className="line-clamp-1">{actNameById.get(obj.usecase_id) ?? `#${obj.usecase_id}`}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 text-right tabular-nums text-[12px]">{obj.count}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${rate}%` }} />
                              </div>
                              <span className={`tabular-nums text-[12px] font-semibold w-9 text-right ${color}`}>{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Simulator Performance ────────────────────────────────────────────── */}
      {simStats.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  {es ? 'Desempeño por Simulador' : 'Simulator Performance'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {es
                    ? `${simStats.length} simuladores · ${simStats.reduce((s, a) => s + a.count, 0).toLocaleString()} simulaciones`
                    : `${simStats.length} simulators · ${simStats.reduce((s, a) => s + a.count, 0).toLocaleString()} simulations`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const totalSims = simStats.reduce((s, a) => s + a.count, 0)
                const overallAvg = totalSims ? Math.round(simStats.reduce((s, a) => s + a.avgScore * a.count, 0) / totalSims) : 0
                const strong = simStats.filter((a) => getTier(a) === 'strong').length
                const attn   = simStats.filter((a) => getTier(a) === 'needs-attention').length
                return (
                  <>
                    <span className="text-[11px] text-accent bg-accent/5 border border-accent/20 px-3 py-1 rounded-full">
                      {es ? 'Prom. global: ' : 'Overall avg: '}{overallAvg}%
                    </span>
                    {strong > 0 && (
                      <span className="text-[11px] text-success bg-success/5 border border-success/20 px-3 py-1 rounded-full">
                        {strong} {es ? 'sólidos' : 'strong'}
                      </span>
                    )}
                    {attn > 0 && (
                      <span className="text-[11px] text-danger bg-danger/5 border border-danger/20 px-3 py-1 rounded-full">
                        {attn} {es ? 'requieren atención' : 'need attention'}
                      </span>
                    )}
                  </>
                )
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {simStats.map((stat, idx) => (
              <SimulatorCard key={stat.id} stat={stat} rank={idx + 1} es={es} />
            ))}
          </div>

          {/* Comparison table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-line/30">
              <h3 className="text-sm font-semibold text-slate-200">
                {es ? 'Resumen Comparativo' : 'Comparative Summary'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line/20 text-left bg-surface/40">
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{es ? 'Simulador' : 'Simulator'}</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">{es ? 'Sims.' : 'Sims'}</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">{es ? 'Puntaje' : 'Score'}</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right hidden sm:table-cell">{es ? 'Aprobación' : 'Pass Rate'}</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">{es ? 'Estado' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/20">
                  {simStats.map((stat, idx) => (
                    <tr key={stat.id} className="hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 py-3 text-slate-600 text-[11px] tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-200 max-w-[240px]">
                        <span className="line-clamp-1 text-[12px]">{stat.name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-right tabular-nums text-[12px]">{stat.count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={cn('font-semibold text-[12px]',
                          stat.avgScore >= 65 ? 'text-success' : stat.avgScore >= 45 ? 'text-yellow-400' : 'text-danger')}>
                          {stat.avgScore}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full',
                                stat.passRate >= 65 ? 'bg-success' : stat.passRate >= 40 ? 'bg-yellow-400' : 'bg-danger')}
                              style={{ width: `${stat.passRate}%` }}
                            />
                          </div>
                          <span className={cn('tabular-nums text-[12px] font-semibold w-9 text-right',
                            stat.passRate >= 65 ? 'text-success' : stat.passRate >= 40 ? 'text-yellow-400' : 'text-danger')}>
                            {stat.passRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right"><TierBadge tier={getTier(stat)} es={es} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!totalSessions && !simStats.length && (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <MessageSquare className="w-10 h-10 text-slate-700" />
          <p className="text-slate-400 text-sm font-medium">{t('no_data')}</p>
          <p className="text-slate-600 text-xs max-w-xs">
            {es
              ? 'No hay sesiones de conversación para el período seleccionado.'
              : 'No conversation sessions for the selected period.'}
          </p>
        </div>
      )}
    </div>
  )
}
