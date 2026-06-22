import { memo, useState, useMemo, useRef, useEffect } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useIntersectionObserver } from '../hooks/useIntersectionObserver'
import {
  computeKPIs, computeActivityStats, computeUserStats, computeScoreDistribution,
} from '../lib/analytics'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { M8_EXERCISES } from '../lib/certification'
import { DateRangeFilter } from '../components/ui/DateRangeFilter'
import { downloadCSV, csvDate } from '../lib/csvExport'
import {
  BarChart3, PlayCircle, CheckCircle2, Users, Download,
  Search, ChevronDown, X, BookOpen, UserCheck,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { Link } from 'react-router-dom'
import { useChartColors } from '../lib/chartTheme'
import { TooltipShell, TRow, TTitle, useTooltipColors, type TooltipColors } from '../components/charts/TooltipShell'

const COLORS = { pass: '#E52B2B', fail: '#fecdd3', accent: '#E52B2B', violet: '#8B5CF6' }

function TrendTooltip({ active, payload, label, es, c }: { active?: boolean; payload?: any[]; label?: string; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  return (
    <TooltipShell c={c} minWidth={160}>
      <TTitle text={String(label ?? '')} c={c} />
      <TRow label={es ? 'Puntaje Prom.' : 'Avg Score'} value={`${payload[0]?.value ?? 0}%`} valueStyle={{ color: c.accent }} c={c} />
    </TooltipShell>
  )
}

function PassFailTooltip({ active, payload, c }: { active?: boolean; payload?: any[]; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TooltipShell c={c} minWidth={140}>
      <TTitle text={d.name} c={c} />
      <TRow label="Count" value={d.value} valueStyle={{ color: d.payload.color }} c={c} />
    </TooltipShell>
  )
}

function ActivityTooltip({ active, payload, es, c }: { active?: boolean; payload?: any[]; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TooltipShell c={c} minWidth={160}>
      <TTitle text={d.payload.name} c={c} />
      <TRow label={es ? 'Sesiones' : 'Sessions'} value={d.value} valueStyle={{ color: c.accent }} c={c} />
    </TooltipShell>
  )
}

function ScoreDistTooltip({ active, payload, es, c }: { active?: boolean; payload?: any[]; es: boolean; c: TooltipColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TooltipShell c={c} minWidth={140}>
      <TTitle text={d.payload.label} c={c} />
      <TRow label={es ? 'Sesiones' : 'Sessions'} value={d.value} valueStyle={{ color: c.accent }} c={c} />
    </TooltipShell>
  )
}

export default function OverviewPage() {
  const language = useAppStore((s) => s.language)
  const t = useTranslation(language)
  const es = language === 'es'

  const c  = useChartColors()
  const tt = useTooltipColors()

  const {
    simsLoading, activitiesLoading, isError,
    quickKpis,          // ← available as soon as sims arrive (no org wait)
    kpis, trend, scoreDist, actStats, userStats,
    sims, activities, members, admins,
    refetch,
  } = useDashboardData()

  // Skeleton only while sims are loading — activities are cached 24 h and arrive
  // almost immediately on any warm session.
  const isLoading = simsLoading

  // Below-fold sections mount lazily when they scroll into view.
  // rootMargin: start loading 120 px before entering the viewport.
  const [belowFoldRef, belowFoldVisible] = useIntersectionObserver({ rootMargin: '120px' })
  const [scoreSentRef, scoreVisible]     = useIntersectionObserver({ rootMargin: '80px' })
  // ── Date range — driven by global Zustand store ─────────────────────────────
  const dateFrom     = useAppStore((s) => s.dateFrom)
  const dateTo       = useAppStore((s) => s.dateTo)
  const setDateRange = useAppStore((s) => s.setDateRange)
  // Convert null → '' so date inputs don't see a controlled→uncontrolled flip
  const from = dateFrom ?? ''
  const to   = dateTo   ?? ''

  // ── User selection filter ────────────────────
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  const allUserNames = useMemo(
    () => Array.from(new Set(sims.map((s) => s.Usuario_Nombre).filter((n): n is string => !!n))).sort(),
    [sims],
  )
  const filteredUserNames = useMemo(
    () => userSearch.trim()
      ? allUserNames.filter((n) => n.toLowerCase().includes(userSearch.toLowerCase()))
      : allUserNames,
    [allUserNames, userSearch],
  )

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleUser(name: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // ── Filter sims by selected users ──────────────────────────────────────────
  // Date filtering is handled globally in useDashboardData (reads from store),
  // so `sims` here is already date-filtered. We only need the user-level slice.
  const filteredSims = useMemo(() => {
    if (selectedUsers.size === 0) return sims
    return sims.filter((s) => s.Usuario_Nombre && selectedUsers.has(s.Usuario_Nombre))
  }, [sims, selectedUsers])

  // anyFilterActive: badge / UX indicator (date filter OR user filter)
  const anyFilterActive  = !!(dateFrom || dateTo) || selectedUsers.size > 0
  // userFilterActive: only re-derive stats when the user-level filter adds a slice on top
  const userFilterActive = selectedUsers.size > 0

  // Re-derive all stats from user-filtered sims when user filter is active.
  // When only a date filter is set, the hook already provides correct stats.
  // Fall back to quickKpis (sims-only) while full kpis is still computing.
  const activeKpis     = useMemo(
    () => userFilterActive ? computeKPIs(filteredSims, activities, members, admins) : (kpis ?? quickKpis),
    [userFilterActive, filteredSims, activities, members, admins, kpis, quickKpis],
  )
  const activeActStats = useMemo(() => userFilterActive ? computeActivityStats(filteredSims, activities) : actStats, [userFilterActive, filteredSims, activities, actStats])
  const activeScoreDist= useMemo(() => userFilterActive ? computeScoreDistribution(filteredSims) : scoreDist,        [userFilterActive, filteredSims, scoreDist])
  const activeUserStats= useMemo(() => userFilterActive ? computeUserStats(filteredSims) : userStats,                [userFilterActive, filteredSims, userStats])

  // trend from useDashboardData is already date-filtered — use it directly
  const filteredTrend = trend ?? []

  // ── CSV exports ─────────────────────────────
  function exportSimCSV() {
    if (!activeKpis) return
    downloadCSV([
      [es ? 'Métrica' : 'Metric',              es ? 'Valor' : 'Value'],
      [es ? 'Total Simulaciones' : 'Total Simulations', activeKpis.totalSimulations],
      [es ? 'Puntaje Promedio'   : 'Average Score',     `${activeKpis.averageScore}%`],
      [es ? 'Tasa de Aprobación' : 'Pass Rate',         `${activeKpis.passRate}%`],
      [es ? 'Asesores Activos'   : 'Active Advisors',   activeKpis.activeAdvisors],
      [es ? 'Aprobados'          : 'Passed',            activeKpis.passCount],
      [es ? 'Reprobados'         : 'Failed',            activeKpis.failCount],
      ...(activeActStats ?? []).map((a) => [a.name, a.count]),
    ], `m8_sim_overview_${csvDate()}.csv`)
  }

  // ── Loading / error ──────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 h-28 skeleton rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5 h-80 skeleton rounded-xl lg:col-span-2" />
          <div className="card p-5 h-80 skeleton rounded-xl" />
        </div>
      </div>
    )
  }

  // Only hard-error if sims failed (can't show anything meaningful)
  if ((isError && !quickKpis) || (!anyFilterActive && !activeKpis && !simsLoading)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-slate-400">{t('error')}</p>
        <button onClick={refetch} className="btn-primary">{t('retry')}</button>
      </div>
    )
  }

  const passFailData = [
    { name: t('pass'), value: activeKpis!.passCount, color: COLORS.pass },
    { name: t('fail'), value: activeKpis!.failCount, color: COLORS.fail },
  ]

  const topActivities = (activeActStats ?? []).slice(0, 5).map((a) => ({
    name: a.name.length > 24 ? a.name.slice(0, 24) + '...' : a.name,
    count: a.count,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          {es ? 'Bienvenido a tu panel' : 'Welcome your dashboard'}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {es
            ? `Tu equipo ha completado ${activeKpis?.totalSimulations ?? '…'} simulaciones este mes.`
            : `Your team has completed ${activeKpis?.totalSimulations ?? '…'} simulations this month.`}
        </p>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period pills */}
        {(['all', '3m', '12m'] as const).map((p) => (
          <button
            key={p}
            onClick={() => {
              if (p === 'all') {
                setDateRange(null, null)
              } else {
                const now = new Date()
                const from = new Date(now)
                from.setMonth(from.getMonth() - (p === '3m' ? 3 : 12))
                setDateRange(from.toISOString().slice(0, 10), now.toISOString().slice(0, 10))
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              (p === 'all' && !dateFrom && !dateTo) ||
              (p === '3m' && dateFrom && dateTo && new Date(dateTo).getTime() - new Date(dateFrom).getTime() < 100 * 24 * 60 * 60 * 1000) ||
              (p === '12m' && dateFrom && dateTo && new Date(dateTo).getTime() - new Date(dateFrom).getTime() >= 100 * 24 * 60 * 60 * 1000)
                ? 'bg-accent text-white'
                : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
            }`}
          >
            {p === 'all' ? (es ? 'Todo' : 'All') : p.toUpperCase()}
          </button>
        ))}

        {/* Date inputs */}
        <input
          type="date"
          value={from}
          onChange={(e) => setDateRange(e.target.value || null, dateTo)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 bg-white focus:outline-none focus:border-accent"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setDateRange(dateFrom, e.target.value || null)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 bg-white focus:outline-none focus:border-accent"
        />

        {/* User filter dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setShowUserDropdown((v) => !v)}
            className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-all ${
              selectedUsers.size > 0
                ? 'text-accent border-accent/40 bg-accent/5'
                : 'text-slate-500 hover:text-slate-700 border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {selectedUsers.size > 0
              ? `${selectedUsers.size} ${es ? 'asesor(es)' : 'advisor(s)'}`
              : (es ? 'Asesores' : 'Advisors')}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {showUserDropdown && (
            <div className="absolute top-full mt-1 right-0 z-30 w-56 sm:w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={es ? 'Buscar...' : 'Search...'}
                    className="w-full bg-gray-50 border border-gray-200 text-slate-700 text-xs rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              {selectedUsers.size > 0 && (
                <div className="px-3 py-1.5 border-b border-gray-100">
                  <button
                    onClick={() => setSelectedUsers(new Set())}
                    className="text-[11px] text-danger hover:text-red-600 flex items-center gap-1"
                  >
                    <X className="w-2.5 h-2.5" /> {es ? 'Limpiar selección' : 'Clear selection'}
                  </button>
                </div>
              )}
              <div className="max-h-52 overflow-y-auto">
                {filteredUserNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => toggleUser(name)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                      selectedUsers.has(name) ? 'text-accent' : 'text-slate-600'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${
                      selectedUsers.has(name) ? 'bg-accent border-accent' : 'border-gray-300'
                    }`}>
                      {selectedUsers.has(name) && <span className="text-white text-[8px] font-bold">✓</span>}
                    </span>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Export All button */}
        <button
          onClick={exportSimCSV}
          className="flex items-center gap-1.5 text-xs text-white bg-accent hover:opacity-90 rounded-lg px-3 py-1.5 transition-all font-medium ml-auto"
          title="Export CSV"
        >
          <Download className="w-3.5 h-3.5" />
          {es ? 'Exportar todo' : 'Export All'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={PlayCircle}   label={t('kpi_total_sims')}         value={activeKpis!.totalSimulations}   sub={t('sub_across_activities')} color="accent"  />
        <KpiCard icon={BarChart3}    label={t('kpi_avg_score')}          value={`${activeKpis!.averageScore}%`} sub={t('sub_overall')}           color="violet"  />
        <KpiCard icon={CheckCircle2} label={t('kpi_pass_rate')}          value={`${activeKpis!.passRate}%`}     sub={t('sub_sessions_passed')}   color="pass"    />
        <KpiCard icon={Users}        label={t('kpi_active_advisors')}    value={activeKpis!.activeAdvisors}     sub={t('sub_with_simulations')}  color="indigo"  />
        <KpiCard icon={BookOpen}     label={t('kpi_total_activities')}   value={M8_EXERCISES.length}            sub={t('sub_cert_slots')}        color="accent"  />
        <KpiCard icon={UserCheck}    label={t('kpi_total_members')}      value={kpis?.totalMembers ?? '…'}      sub={t('sub_registered')}        color="violet"  />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-5 sm:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">{t('score_trend')}</h3>
            {anyFilterActive && (
              <span className="text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                {filteredSims.length} {es ? 'sims filtradas' : 'filtered sims'}
              </span>
            )}
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<TrendTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ stroke: c.cursorStroke, strokeWidth: 1.5 }} />
                <Area type="monotone" dataKey="avgScore" stroke={COLORS.accent} strokeWidth={2} fill="url(#scoreGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('pass_fail_dist')}</h3>
          <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={passFailData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                  {passFailData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<PassFailTooltip c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{activeKpis!.passRate}%</p>
                <p className="text-[10px] text-slate-500">{es ? 'Aprobados' : 'Pass Rate'}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {passFailData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Below-fold row: Activity breakdown + Top performers ─────────────── */}
      {/* Sentinel div — the IntersectionObserver watches this element.         */}
      {/* Once it enters the viewport the charts mount; until then only a       */}
      {/* lightweight placeholder occupies the layout so there is no CLS.       */}
      <div ref={belowFoldRef}>
        {belowFoldVisible ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Activity breakdown — needs actStats (sims + activities) */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('activity_breakdown')}</h3>
              {activitiesLoading ? (
                <div className="h-64 skeleton rounded-lg" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topActivities} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 'dataMax + 5']} hide />
                      <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                      <Tooltip content={<ActivityTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ fill: c.cursorFill }} />
                      <Bar dataKey="count" fill={COLORS.accent} radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Top performers — needs userStats (sims only, fast) */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">{t('top_performers')}</h3>
                <Link to="/leaderboard" className="text-xs text-accent hover:underline">{t('view_all')}</Link>
              </div>
              <div className="space-y-2">
                {(activeUserStats ?? []).slice(0, 5).map((u, i) => (
                  <div key={u.name} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-600' :
                      i === 1 ? 'bg-gray-100 text-gray-500' :
                      i === 2 ? 'bg-orange-100 text-orange-500' :
                      'bg-gray-50 text-slate-400'
                    }`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{u.name}</p>
                      <p className="text-[11px] text-slate-400">{u.count} {t('simulations_count')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">{u.avgScore}%</p>
                      <p className="text-[11px] text-slate-400">{u.passRate}% {t('pass')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Placeholder — preserves layout height to avoid CLS when charts mount */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5 h-80 skeleton rounded-xl" />
            <div className="card p-5 h-80 skeleton rounded-xl" />
          </div>
        )}
      </div>

      {/* ── Score distribution — furthest below fold ──────────────────────────── */}
      <div ref={scoreSentRef}>
        {scoreVisible ? (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">{t('score_distribution')}</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeScoreDist ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip content={<ScoreDistTooltip es={es} c={tt} />} wrapperStyle={{ zIndex: 50, outline: 'none' }} cursor={{ fill: c.cursorFill }} />
                  <Bar dataKey="count" fill={COLORS.accent} radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="card p-5 h-72 skeleton rounded-xl" />
        )}
      </div>
    </div>
  )
}

const KpiCard = memo(function KpiCard({
  icon: Icon, label, value, sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string; value: string | number; sub: string
  color: 'accent' | 'violet' | 'pass' | 'indigo'
}) {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 ml-2">
          <Icon className="w-5 h-5 text-accent" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 tracking-tight">{value}</p>
      <p className="text-[11px] text-slate-400 mt-1 truncate">{sub}</p>
    </div>
  )
})
