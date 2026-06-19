import { useState, useMemo, Fragment } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation, type TKey } from '../lib/i18n'
import { useDebounce } from '../lib/useDebounce'
import { PASS_THRESHOLD } from '../lib/analytics'
import { DateRangeFilter } from '../components/ui/DateRangeFilter'
import { SimReportModal } from '../components/ui/SimReportModal'
import {
  Search, Calendar, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, BadgeCheck, FileText, Target, ListChecks, Gauge, Lock, Download,
} from 'lucide-react'
import { cn } from '../lib/cn'

const PAGE_SIZE = 50

const CRITERIA: { icon: React.ComponentType<{ className?: string }>; titleKey: TKey; descKey: TKey }[] = [
  { icon: Target,     titleKey: 'criteria_verdict_t', descKey: 'criteria_verdict_d' },
  { icon: ListChecks, titleKey: 'criteria_rounds_t',  descKey: 'criteria_rounds_d' },
  { icon: Gauge,      titleKey: 'criteria_score_t',   descKey: 'criteria_score_d' },
  { icon: Lock,       titleKey: 'criteria_attempt_t', descKey: 'criteria_attempt_d' },
]

export default function SimulationsPage() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  const { isLoading, isError, sims, activities, refetch } = useDashboardData()

  // Global date range — same store the Overview page uses
  const dateFrom     = useAppStore((s) => s.dateFrom)
  const dateTo       = useAppStore((s) => s.dateTo)
  const setDateRange = useAppStore((s) => s.setDateRange)

  // All hooks declared unconditionally — before any conditional returns
  const [searchRaw,    setSearchRaw]    = useState('')
  const [expandedId,   setExpandedId]   = useState<number | null>(null)
  const [page,         setPage]         = useState(0)
  const [showCriteria, setShowCriteria] = useState(false)
  const [reportSimId,  setReportSimId]  = useState<number | null>(null)

  const search = useDebounce(searchRaw, 300)

  const actMap = useMemo(
    () => new Map(activities.map((a) => [a.ID_Caso_de_Uso, a])),
    [activities],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return sims
    return sims.filter((s) =>
      (s.Usuario_Nombre ?? '').toLowerCase().includes(q) ||
      (actMap.get(s.ID_Caso_de_Uso)?.Caso_de_Uso ?? '').toLowerCase().includes(q) ||
      s.Fecha_y_Hora.includes(q),
    )
  }, [sims, search, actMap])

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

  function handleSearch(val: string) {
    setSearchRaw(val)
    setPage(0)
    setExpandedId(null)
  }

  const es = language === 'es'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_sims_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_sims_subtitle')}</p>
      </div>

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

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line/40">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_advisor')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_activity')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{t('col_date')}</span>
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_score')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_status')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_details')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => {
                const expanded = expandedId === s.ID_Sim
                const activity = actMap.get(s.ID_Caso_de_Uso)
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
                        <span className={cn('font-semibold', s.Calificacion >= PASS_THRESHOLD ? 'text-success' : 'text-danger')}>
                          {s.Calificacion}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.Diagnostico_Final?.toLowerCase() === 'si' ? (
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
                        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
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
                            <a
                              href={`https://rolplay.app/reportes/visor-usecase.php?&saex=${s.ID_Sim}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-xs text-slate-400 border border-line/50 hover:text-slate-100 hover:border-line rounded-lg px-3 py-1.5 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {t('report_download')}
                            </a>
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
