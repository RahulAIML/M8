import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, FileText, CheckCircle2, XCircle, Stethoscope, User, ClipboardList, Download, BarChart2 } from 'lucide-react'
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

// Wraps a closing_analysis HTML fragment into a full document for blob/iframe rendering
function wrapClosingHtml(fragment: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;padding:0;background:#f0f0f0}</style>
</head><body>${fragment}</body></html>`
}

// ─── main modal ──────────────────────────────────────────────────────────────

export function SimReportModal({ simId, language, onClose }: Props) {
  const t   = useTranslation(language)
  const es  = language === 'es'

  const { data: report, isLoading, isError } = useSimReport(simId)

  const score   = report?.Calificacion ?? 0
  const product = report?.Producto || report?.Titulo || t('report_title')
  const rondas  = report?.Rondas ?? []

  // Blob URL for the closing_analysis iframe — created once per report, cleaned up on unmount
  const [closingBlobUrl, setClosingBlobUrl] = useState<string | null>(null)
  const [iframeHeight, setIframeHeight] = useState(500)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!report?.closing_analysis) { setClosingBlobUrl(null); return }
    const html = wrapClosingHtml(report.closing_analysis)
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    setClosingBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [report?.closing_analysis])

  // Auto-resize iframe to its content height once loaded
  function handleIframeLoad() {
    try {
      const doc = iframeRef.current?.contentDocument
      if (doc) setIframeHeight(doc.documentElement.scrollHeight + 16)
    } catch { /* cross-origin guard */ }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleDownload() {
    if (!report) return
    const scoreColor = score >= 70 ? '#16a34a' : score >= 40 ? '#ca8a04' : '#dc2626'

    const rondasHtml = rondas.map((r) => `
      <div class="ronda">
        <div class="ronda-hdr">
          ${es ? `Interacción ${r.n}` : `Interaction ${r.n}`}
          <span class="pts">${r.puntos ?? '–'} / ${r.max_puntos} pt</span>
        </div>
        ${r.pregunta ? `<div class="box doc"><b>${es ? 'Médico' : 'Doctor'}:</b> ${r.pregunta}</div>` : ''}
        ${r.respuesta_rep ? `<div class="box rep"><b>${es ? 'Asesor' : 'Sales Rep'}:</b> ${r.respuesta_rep}</div>` : `<div class="box rep"><em style="color:#999">${es ? 'Sin transcripción' : 'No transcription'}</em></div>`}
        ${r.criterio ? `<div class="field"><b>${es ? 'Criterio' : 'Criteria'}:</b> ${r.criterio}</div>` : ''}
        ${r.respuesta_modelo ? `<div class="field"><b>${es ? 'Respuesta modelo' : 'Model answer'}:</b> ${r.respuesta_modelo}</div>` : ''}
        ${r.analisis ? `<div class="field"><b>${es ? 'Análisis' : 'Analysis'}:</b> ${r.analisis}</div>` : ''}
      </div>`).join('')

    const closingSection = report.closing_analysis
      ? `<div style="margin-bottom:32px">${report.closing_analysis}</div>
         <h2 style="font-family:Arial,sans-serif;font-size:16px;color:#333;margin:0 0 16px;padding-top:8px;border-top:2px solid #e0e0e0">
           ${es ? 'Detalle de Interacciones' : 'Interaction Detail'}
         </h2>`
      : `<div style="margin-bottom:16px">
           <h1 style="font-family:Arial,sans-serif;font-size:18px;margin:0 0 4px">${product}</h1>
           <div style="color:#666;font-size:12px;margin-bottom:20px">
             ${report.Usuario_Nombre} &nbsp;·&nbsp; ${(report.Fecha_y_Hora ?? '').substring(0, 16)}
             &nbsp;·&nbsp; <span style="font-weight:700;color:${scoreColor}">${score}%</span>
           </div>
         </div>`

    const win = window.open('', '_blank', 'width=960,height=800')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>${product} — ${report.Usuario_Nombre}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:0;padding:24px;font-size:14px}
        .ronda{border:1px solid #ddd;border-radius:8px;padding:14px;margin-bottom:12px;page-break-inside:avoid}
        .ronda-hdr{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#888;display:flex;justify-content:space-between;margin-bottom:10px}
        .pts{color:#111}
        .box{border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:13px;line-height:1.5}
        .doc{background:#eff6ff;border:1px solid #bfdbfe}
        .rep{background:#f0fdf4;border:1px solid #bbf7d0}
        .field{font-size:12px;color:#444;margin-top:8px;padding-top:8px;border-top:1px solid #f0f0f0}
        .field b{display:block;color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
        @media print{body{padding:0}.rp-coach-report{box-shadow:none!important;border-radius:0!important}}
      </style></head><body>
      ${closingSection}
      ${rondasHtml}
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
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

            {/* Download — only active once report is loaded */}
            <button
              onClick={handleDownload}
              disabled={!report}
              title={t('report_download')}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Open in RolPlay platform — external link, requires platform login */}
            {report ? (
              <a
                href={`https://rolplay.app/summary.php?id=${report.ID_Sim}`}
                target="_blank"
                rel="noopener noreferrer"
                title={es ? 'Ver reporte en RolPlay (requiere sesión)' : 'View report on RolPlay (requires login)'}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <span className="p-1.5 shrink-0 opacity-30 cursor-not-allowed">
                <ExternalLink className="w-4 h-4 text-slate-500" />
              </span>
            )}

            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading && (
            <div className="px-4 sm:px-5 py-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-52 skeleton rounded-xl" />
              ))}
            </div>
          )}
          {isError && <p className="text-sm text-danger px-5 py-4">{t('report_error')}</p>}

          {report && (
            <>
              {/* ── Closing Report (score summary, adoption level, evaluación, fortalezas, recomendaciones) ── */}
              {closingBlobUrl && (
                <div className="border-b border-line/30">
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-[#3A1C71]/20 border-b border-[#3A1C71]/30">
                    <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-300">
                      {es ? 'Reporte de Cierre' : 'Closing Report'}
                    </span>
                  </div>
                  <iframe
                    ref={iframeRef}
                    src={closingBlobUrl}
                    onLoad={handleIframeLoad}
                    className="w-full border-0 block"
                    style={{ height: `${iframeHeight}px` }}
                    sandbox="allow-same-origin"
                    title={es ? 'Reporte de cierre' : 'Closing report'}
                  />
                </div>
              )}

              {/* ── Interactions ── */}
              {rondas.length > 0 && (
                <div className="px-4 sm:px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {es ? 'Detalle de Interacciones' : 'Interaction Detail'}
                    </span>
                  </div>
                  {rondas.map((ronda) => (
                    <RondaCard key={ronda.n} ronda={ronda} es={es} />
                  ))}
                </div>
              )}

              {/* Legacy secciones (old report format) */}
              {report.Secciones?.length > 0 && (
                <div className="px-4 sm:px-5 pb-4">
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
                </div>
              )}

              {rondas.length === 0 && !report.Secciones?.length && !report.closing_analysis && (
                <p className="text-sm text-slate-500 text-center py-8">{t('no_data')}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
