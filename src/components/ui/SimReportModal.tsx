import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, Loader2, FileText, CheckCircle2, XCircle, Stethoscope, User, ClipboardList, Download } from 'lucide-react'
import { useSimReport } from '../../api/queries'
import { useTranslation } from '../../lib/i18n'
import type { Language } from '../../store'
import type { SimRonda } from '../../api/types'
import { cn } from '../../lib/cn'

interface Props {
  simId: number
  language: Language
  onClose: () => void
}

const REPORT_BASE = 'https://improveyourpitchbeta.net/demorp6/reportes/visor-usecase.php?&saex='

// ─── sub-components ──────────────────────────────────────────────────────────

function ScoreBadge({ pts, max }: { pts: number | null; max: number }) {
  if (pts === null)
    return <span className="text-[10px] text-slate-600 border border-line/30 rounded-full px-2 py-0.5">—</span>
  const pass = pts >= max
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border',
      pass ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30',
    )}>
      {pass ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {pts} / {max} pt
    </span>
  )
}

function RondaCard({ ronda, es }: { ronda: SimRonda; es: boolean }) {
  const hasFeedback = ronda.criterio || ronda.respuesta_modelo || ronda.analisis
  return (
    <div className="border border-line/30 rounded-xl overflow-hidden bg-white/[0.01]">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-line/20">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {es ? `Interacción ${ronda.n}` : `Interaction ${ronda.n}`}
        </span>
        <ScoreBadge pts={ronda.puntos} max={ronda.max_puntos} />
      </div>
      <div className="p-4 space-y-3">
        {ronda.pregunta && (
          <div className="flex gap-2.5 items-start">
            <div className="w-7 h-7 rounded-full bg-[#1b2a49] border border-blue-900/60 flex items-center justify-center shrink-0 mt-0.5">
              <Stethoscope className="w-3.5 h-3.5 text-blue-300" />
            </div>
            <div className="flex-1 bg-[#1b2a49]/30 border border-blue-900/30 rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-blue-400/60 font-semibold mb-0.5 uppercase tracking-wide">
                {es ? 'Médico' : 'Doctor'}
              </p>
              <p className="text-sm text-slate-200 leading-relaxed">{ronda.pregunta}</p>
            </div>
          </div>
        )}
        <div className="flex gap-2.5 items-start">
          <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-3.5 h-3.5 text-accent" />
          </div>
          {ronda.respuesta_rep ? (
            <div className="flex-1 bg-accent/5 border border-accent/20 rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-accent/60 font-semibold mb-0.5 uppercase tracking-wide">
                {es ? 'Representante' : 'Sales Rep'}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{ronda.respuesta_rep}</p>
            </div>
          ) : (
            <div className="flex-1 bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-3 py-2.5">
              <p className="text-xs text-yellow-400/70 italic">
                {es ? 'No se encontró transcripción en la respuesta.' : 'No transcription found in response.'}
              </p>
            </div>
          )}
        </div>
        {hasFeedback && (
          <div className="pt-3 border-t border-line/20 space-y-3">
            {ronda.criterio && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {es ? 'Criterio a evaluar' : 'Evaluation Criteria'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">{ronda.criterio}</p>
              </div>
            )}
            {ronda.respuesta_modelo && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {es ? 'Respuesta modelo' : 'Model Answer'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{ronda.respuesta_modelo}</p>
              </div>
            )}
            {ronda.analisis && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {es ? 'Análisis de tu respuesta' : 'Response Analysis'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">{ronda.analisis}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function verdictColor(a: string): string | null {
  const v = a.trim().toLowerCase()
  if (v === 'si' || v === 'sí') return 'text-success'
  if (v === 'no') return 'text-danger'
  return null
}

// ─── main modal ──────────────────────────────────────────────────────────────

export function SimReportModal({ simId, language, onClose }: Props) {
  const t   = useTranslation(language)
  const es  = language === 'es'
  const url = `${REPORT_BASE}${simId}`

  const [tab, setTab]         = useState<'breakdown' | 'platform'>('breakdown')
  const [iframeLoading, setIframeLoading] = useState(true)

  const { data: report, isLoading, isError } = useSimReport(simId)

  const score   = report?.Calificacion ?? 0
  const product = report?.Producto || report?.Titulo || t('report_title')
  const rondas  = report?.Rondas ?? []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Reset iframe loading flag when switching to platform tab
  useEffect(() => {
    if (tab === 'platform') setIframeLoading(true)
  }, [tab])

  function handleDownload() {
    if (tab === 'platform' || !report) { window.open(url, '_blank'); return }
    const scoreColor = score >= 70 ? '#16a34a' : score >= 40 ? '#ca8a04' : '#dc2626'
    const rondasHtml = rondas.map((r) => `
      <div class="ronda">
        <div class="ronda-hdr">
          ${es ? `Interacción ${r.n}` : `Interaction ${r.n}`}
          <span class="pts">${r.puntos ?? '–'} / ${r.max_puntos} pt</span>
        </div>
        ${r.pregunta ? `<div class="box doc"><b>${es ? 'Médico' : 'Doctor'}:</b> ${r.pregunta}</div>` : ''}
        ${r.respuesta_rep ? `<div class="box rep"><b>${es ? 'Asesor' : 'Sales Rep'}:</b> ${r.respuesta_rep}</div>` : '<div class="box rep"><em style="color:#999">${es ? "Sin transcripción" : "No transcription"}</em></div>'}
        ${r.criterio ? `<div class="field"><b>${es ? 'Criterio' : 'Criteria'}:</b> ${r.criterio}</div>` : ''}
        ${r.respuesta_modelo ? `<div class="field"><b>${es ? 'Respuesta modelo' : 'Model answer'}:</b> ${r.respuesta_modelo}</div>` : ''}
        ${r.analisis ? `<div class="field"><b>${es ? 'Análisis' : 'Analysis'}:</b> ${r.analisis}</div>` : ''}
      </div>`).join('')
    const win = window.open('', '_blank', 'width=900,height=720')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>${product} — ${report.Usuario_Nombre}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:0;padding:24px;font-size:14px}
        h1{font-size:18px;margin:0 0 4px}
        .meta{color:#666;font-size:12px;margin-bottom:20px}
        .score{font-weight:700;color:${scoreColor}}
        .ronda{border:1px solid #ddd;border-radius:8px;padding:14px;margin-bottom:12px;page-break-inside:avoid}
        .ronda-hdr{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#888;display:flex;justify-content:space-between;margin-bottom:10px}
        .pts{color:#111}
        .box{border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:13px;line-height:1.5}
        .doc{background:#eff6ff;border:1px solid #bfdbfe}
        .rep{background:#f0fdf4;border:1px solid #bbf7d0}
        .field{font-size:12px;color:#444;margin-top:8px;padding-top:8px;border-top:1px solid #f0f0f0}
        .field b{display:block;color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>${product}</h1>
      <div class="meta">${report.Usuario_Nombre} &nbsp;·&nbsp; ${(report.Fecha_y_Hora ?? '').substring(0, 16)} &nbsp;·&nbsp; <span class="score">${score}%</span></div>
      ${rondasHtml}
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 350)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card border border-line rounded-t-2xl sm:rounded-2xl w-full sm:max-w-4xl h-[94dvh] sm:h-[90vh] flex flex-col shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 py-3.5 border-b border-line/40 bg-[#1b2a49]/20 rounded-t-2xl shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-[#1b2a49] border border-blue-900/50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-slate-100 truncate">{product}</h2>
                {report && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-xs text-slate-500 truncate">
                      {report.Usuario_Nombre} · {(report.Fecha_y_Hora ?? '').substring(0, 16)}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', score >= 70 ? 'bg-success' : score >= 40 ? 'bg-yellow-400' : 'bg-danger')}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className={cn('text-xs font-bold tabular-nums', score >= 70 ? 'text-success' : score >= 40 ? 'text-yellow-400' : 'text-danger')}>
                        {score}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleDownload}
              title={t('report_download')}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors shrink-0"
            >
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setTab('breakdown')}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                tab === 'breakdown'
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'border-line/40 text-slate-500 hover:text-slate-300 hover:border-line',
              )}
            >
              {es ? 'Desglose' : 'Breakdown'}
            </button>
            <button
              onClick={() => setTab('platform')}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                tab === 'platform'
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'border-line/40 text-slate-500 hover:text-slate-300 hover:border-line',
              )}
            >
              {es ? 'Reporte oficial' : 'Official report'}
            </button>
            {tab === 'platform' && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-slate-600 hover:text-slate-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {es ? 'Nueva pestaña' : 'New tab'}
              </a>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 relative">

          {/* Breakdown tab */}
          {tab === 'breakdown' && (
            <div className="absolute inset-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-52 skeleton rounded-xl" />
              ))}
              {isError && <p className="text-sm text-danger">{t('report_error')}</p>}
              {report && (
                <>
                  {rondas.map((ronda) => (
                    <RondaCard key={ronda.n} ronda={ronda} es={es} />
                  ))}
                  {report.Secciones?.length > 0 && (
                    <div className="border border-line/30 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-line/20">
                        <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {es ? 'Evaluación Final' : 'Final Assessment'}
                        </span>
                      </div>
                      <div className="p-4 space-y-4">
                        {report.Secciones.map((sec, i) => {
                          const vc = verdictColor(sec.a)
                          return (
                            <div key={i}>
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{sec.q}</p>
                              {vc ? (
                                <p className={`text-base font-bold ${vc}`}>{sec.a}</p>
                              ) : (
                                <div className="text-xs text-slate-400 leading-relaxed space-y-1">
                                  {sec.a.split('\n').map((line, j) =>
                                    line.trim() ? <p key={j}>{sec.a.includes('\n') ? '• ' : ''}{line}</p> : null,
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {rondas.length === 0 && !report.Secciones?.length && (
                    <p className="text-sm text-slate-500 text-center py-8">{t('no_data')}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Platform report iframe tab */}
          {tab === 'platform' && (
            <div className="absolute inset-0">
              {iframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card z-10">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                  <p className="text-xs text-slate-600">{es ? 'Cargando reporte...' : 'Loading report...'}</p>
                </div>
              )}
              <iframe
                src={url}
                className="w-full h-full border-0 rounded-b-2xl"
                onLoad={() => setIframeLoading(false)}
                title={`${t('report_title')} ${simId}`}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
