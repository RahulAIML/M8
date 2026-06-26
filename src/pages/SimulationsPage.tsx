import { useState, useMemo, Fragment } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation, type TKey } from '../lib/i18n'
import { useDebounce } from '../lib/useDebounce'
import { PASS_THRESHOLD } from '../lib/analytics'
import { DateRangeFilter } from '../components/ui/DateRangeFilter'
import { SimReportModal } from '../components/ui/SimReportModal'
import {
  Search, Calendar, CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, BadgeCheck, FileText, Target, ListChecks, Gauge, Lock,
  ChevronsUpDown,
} from 'lucide-react'
import { cn } from '../lib/cn'

const PAGE_SIZE = 50

type StatusFilter = 'all' | 'pass' | 'fail' | 'incomplete'
type SortCol     = 'advisor' | 'activity' | 'date' | 'score' | 'status'
type SortDir     = 'asc' | 'desc'

const CRITERIA: { icon: React.ComponentType<{ className?: string }>; titleKey: TKey; descKey: TKey }[] = [
  { icon: Target,     titleKey: 'criteria_verdict_t', descKey: 'criteria_verdict_d' },
  { icon: ListChecks, titleKey: 'criteria_rounds_t',  descKey: 'criteria_rounds_d' },
  { icon: Gauge,      titleKey: 'criteria_score_t',   descKey: 'criteria_score_d' },
  { icon: Lock,       titleKey: 'criteria_attempt_t', descKey: 'criteria_attempt_d' },
]

function simStatus(cal: number | null | undefined, diag: string | null | undefined): 'pass' | 'fail' | 'incomplete' {
  if (cal === null || cal === undefined) return 'incomplete'
  return diag?.toLowerCase() === 'si' ? 'pass' : 'fail'
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (col !== sortCol) return <ChevronsUpDown className="w-3 h-3 opacity-30 ml-1 inline-block" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 ml-1 inline-block text-accent" />
    : <ChevronDown className="w-3 h-3 ml-1 inline-block text-accent" />
}

export default function SimulationsPage() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  const { isLoading, isError, sims, activities, refetch } = useDashboardData()

  const dateFrom     = useAppStore((s) => s.dateFrom)
  const dateTo       = useAppStore((s) => s.dateTo)
  const setDateRange = useAppStore((s) => s.setDateRange)

  const [searchRaw,    setSearchRaw]    = useState('')
  const [expandedId,   setExpandedId]   = useState<number | null>(null)
  const [page,         setPage]         = useState(0)
  const [showCriteria, setShowCriteria] = useState(false)
  const [reportSimId,  setReportSimId]  = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortCol,      setSortCol]      = useState<SortCol>('date')
  const [sortDir,      setSortDir]      = useState<SortDir>('desc')

  const search = useDebounce(searchRaw, 300)

  const actMap = useMemo(
    () => new Map(activities.map((a) => [a.ID_Caso_de_Uso, a])),
    [activities],
  )

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir(col === 'date' ? 'desc' : 'asc')
    }
    setPage(0)
    setExpandedId(null)
  }

  function handleStatusFilter(s: StatusFilter) {
    setStatusFilter(s)
    setPage(0)
    setExpandedId(null)
  }

  function handleSearch(val: string) {
    setSearchRaw(val)
    setPage(0)
    setExpandedId(null)
  }

  const statusCounts = useMemo(() => {
    let pass = 0, fail = 0, incomplete = 0
    for (const s of sims) {
      const st = simStatus(s.Calificacion, s.Diagnostico_Final)
      if (st === 'pass') pass++
      else if (st === 'fail') fail++
      else incomplete++
    }
    return { pass, fail, incomplete, all: sims.length }
  }, [sims])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let rows = sims

    if (statusFilter !== 'all') {
      rows = rows.filter((s) => simStatus(s.Calificacion, s.Diagnostico_Final) === statusFilter)
    }

    if (q) {
      rows = rows.filter((s) =>
        (s.Usuario_Nombre ?? '').toLowerCase().includes(q) ||
        (actMap.get(s.ID_Caso_de_Uso)?.Caso_de_Uso ?? '').toLowerCase().includes(q) ||
        s.Fecha_y_Hora.includes(q),
      )
    }

    const statusRank = { pass: 0, fail: 1, incomplete: 2 } as const
    return [...rows].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'advisor') {
        cmp = (a.Usuario_Nombre ?? '').localeCompare(b.Usuario_Nombre ?? '')
      } else if (sortCol === 'activity') {
        const na = actMap.get(a.ID_Caso_de_Uso)?.Caso_de_Uso ?? ''
        const nb = actMap.get(b.ID_Caso_de_Uso)?.Caso_de_Uso ?? ''
        cmp = na.localeCompare(nb)
      } else if (sortCol === 'date') {
        cmp = a.Fecha_y_Hora.localeCompare(b.Fecha_y_Hora)
      } else if (sortCol === 'score') {
        const sa = a.Calificacion ?? -1
        const sb = b.Calificacion ?? -1
        cmp = sa - sb
      } else if (sortCol === 'status') {
        cmp = statusRank[simStatus(a.Calificacion, a.Diagnostico_Final)] -
              statusRank[simStatus(b.Calificacion, b.Diagnostico_Final)]
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [sims, search, actMap, statusFilter, sortCol, sortDir])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const displayPage = Math.min(page, totalPages - 1)

  const paginated = useMemo(
    () => filtered.slice(displayPage * PAGE_SIZE, (displayPage + 1) * PAGE_SIZE),
    [filtered, displayPage],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 skeleton rounded-lg" />
        <div className="card p-5 h-96 skeleton rounded-xl" />
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

  const es = language === 'es'

  const STATUS_TABS: { key: StatusFilter; labelKey: TKey; count: number; activeClass: string }[] = [
    { key: 'all',        labelKey: 'sim_filter_all',        count: statusCounts.all,        activeClass: 'text-slate-200 border-slate-400 bg-slate-400/10' },
    { key: 'pass',       labelKey: 'sim_filter_pass',       count: statusCounts.pass,       activeClass: 'text-success border-success bg-success/10' },
    { key: 'fail',       labelKey: 'sim_filter_fail',       count: statusCounts.fail,       activeClass: 'text-danger border-danger bg-danger/10' },
    { key: 'incomplete', labelKey: 'sim_filter_incomplete', count: statusCounts.incomplete, activeClass: 'text-slate-400 border-slate-500 bg-slate-500/10' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_sims_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_sims_subtitle')}</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            value={searchRaw}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('filter_search')}
            className="input w-full pl-9"
          />
        </div>
        <DateRangeFilter
          from={dateFrom ?? ''} to={dateTo ?? ''}
          onApply={(f, to_) => { setDateRange(f || null, to_ || null); setPage(0); setExpandedId(null) }}
        />
        <button
          onClick={() => setShowCriteria((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-all',
            showCriteria
              ? 'text-accent border-accent/40 bg-accent/5'
              : 'text-slate-400 hover:text-slate-200 border-line/50 hover:border-line',
          )}
        >
          <BadgeCheck className="w-3.5 h-3.5" />
          {t('criteria_btn')}
          {showCriteria ? <ChevronUp className="w-3 h-3 opacity-60" /> : <ChevronDown className="w-3 h-3 opacity-60" />}
        </button>
        <span className="text-xs text-slate-600 ml-auto">
          {filtered.length} {t('simulations_count')}
          {filtered.length !== sims.length && (
            <span className="text-slate-700"> / {sims.length} total</span>
          )}
        </span>
      </div>

      {/* Criteria panel */}
      {showCriteria && (
        <div className="card p-4 sm:p-5 border border-accent/20">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">{t('criteria_title')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CRITERIA.map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="rounded-xl bg-surface/60 border border-line/30 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                  </span>
                  <span className="text-xs font-semibold text-slate-200">{t(titleKey)}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(({ key, labelKey, count, activeClass }) => (
          <button
            key={key}
            onClick={() => handleStatusFilter(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
              statusFilter === key
                ? activeClass
                : 'text-slate-500 border-line/40 hover:text-slate-300 hover:border-line',
            )}
          >
            {key === 'all'        && <ChevronsUpDown className="w-3 h-3" />}
            {key === 'pass'       && <CheckCircle2   className="w-3 h-3" />}
            {key === 'fail'       && <XCircle        className="w-3 h-3" />}
            {key === 'incomplete' && <MinusCircle    className="w-3 h-3" />}
            {t(labelKey)}
            <span className={cn(
              'ml-0.5 tabular-nums text-[10px] rounded-full px-1.5 py-0.5',
              statusFilter === key ? 'bg-current/10 opacity-80' : 'bg-surface text-slate-600',
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line/40 bg-surface/30">
                {(
                  [
                    { col: 'advisor'  as SortCol, labelKey: 'col_advisor'  as TKey, icon: null },
                    { col: 'activity' as SortCol, labelKey: 'col_activity' as TKey, icon: null },
                    { col: 'date'     as SortCol, labelKey: 'col_date'     as TKey, icon: <Calendar className="w-3 h-3 inline-block mr-0.5" /> },
                    { col: 'score'    as SortCol, labelKey: 'col_score'    as TKey, icon: null },
                    { col: 'status'   as SortCol, labelKey: 'col_status'   as TKey, icon: null },
                  ]
                ).map(({ col, labelKey, icon }) => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300 transition-colors"
                  >
                    {icon}{t(labelKey)}
                    <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                  </th>
                ))}
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_details')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => {
                const expanded = expandedId === s.ID_Sim
                const activity = actMap.get(s.ID_Caso_de_Uso)
                const st = simStatus(s.Calificacion, s.Diagnostico_Final)
                return (
                  <Fragment key={s.ID_Sim}>
                    <tr
                      className="border-b border-line/20 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : s.ID_Sim)}
                    >
                      <td className="px-4 py-3 text-slate-200 font-medium">{s.Usuario_Nombre}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-[200px]">
                        <span className="truncate block">{activity?.Caso_de_Uso ?? `ID ${s.ID_Caso_de_Uso}`}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{s.Fecha_y_Hora.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('font-semibold tabular-nums',
                          st === 'incomplete' ? 'text-slate-500'
                          : st === 'pass'     ? 'text-success'
                          : 'text-danger'
                        )}>
                          {s.Calificacion !== null && s.Calificacion !== undefined ? `${s.Calificacion}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {st === 'incomplete' ? (
                          <span className="badge bg-slate-500/10 text-slate-500">
                            <MinusCircle className="w-3 h-3" /> {t('status_incomplete')}
                          </span>
                        ) : st === 'pass' ? (
                          <span className="badge bg-success/10 text-success">
                            <CheckCircle2 className="w-3 h-3" /> {t('status_pass')}
                          </span>
                        ) : (
                          <span className="badge bg-danger/10 text-danger">
                            <XCircle className="w-3 h-3" /> {t('status_fail')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {expanded
                          ? <ChevronUp className="w-4 h-4 text-slate-500" />
                          : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="bg-surface/50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="flex justify-end gap-2 mb-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); setReportSimId(s.ID_Sim) }}
                              className="flex items-center gap-1.5 text-xs text-accent border border-accent/30 hover:bg-accent/10 rounded-lg px-3 py-1.5 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {t('report_btn')}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[1, 2, 3, 4, 5, 6].map((r) => {
                              const q    = s[`Pregunta_${r}` as keyof typeof s] as string | null
                              const resp = s[`Respuesta_${r}` as keyof typeof s] as string | null
                              const pts  = s[`Puntos_${r}` as keyof typeof s] as number | string | null
                              const fb   = s[`Retroalimentacion_${r}` as keyof typeof s] as string | null
                              if (!q) return null
                              const scored = typeof pts === 'number'
                              return (
                                <div key={r} className="card p-3 border border-line/40">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t('round')} {r}</span>
                                    {scored ? (
                                      <span className={cn('text-xs font-bold', pts > 0 ? 'text-success' : 'text-danger')}>
                                        {pts} {t('points')}
                                      </span>
                                    ) : (
                                      <span className="text-xs font-bold text-slate-600">—</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 mb-1 line-clamp-2">{q}</p>
                                  {resp && <p className="text-xs text-slate-500 line-clamp-2 mb-1">{resp}</p>}
                                  {fb && fb !== 'No aplica' && <p className="text-[11px] text-slate-600 bg-surface rounded px-2 py-1">{fb}</p>}
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {paginated.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">{t('no_data')}</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {es
              ? `Mostrando ${displayPage * PAGE_SIZE + 1}–${Math.min((displayPage + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length}`
              : `Showing ${displayPage * PAGE_SIZE + 1}–${Math.min((displayPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setPage((p) => Math.max(0, p - 1)); setExpandedId(null) }}
              disabled={displayPage === 0}
              className="p-1.5 rounded-lg border border-line/50 disabled:opacity-30 hover:border-line transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 tabular-nums">{displayPage + 1} / {totalPages}</span>
            <button
              onClick={() => { setPage((p) => Math.min(totalPages - 1, p + 1)); setExpandedId(null) }}
              disabled={displayPage >= totalPages - 1}
              className="p-1.5 rounded-lg border border-line/50 disabled:opacity-30 hover:border-line transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {reportSimId !== null && (
        <SimReportModal simId={reportSimId} language={language} onClose={() => setReportSimId(null)} />
      )}
    </div>
  )
}
