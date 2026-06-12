import { useEffect, useState } from 'react'
import { X, ExternalLink, Loader2, FileText } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import type { Language } from '../../store'

interface Props {
  simId: number
  language: Language
  onClose: () => void
}

const REPORT_BASE = 'https://improveyourpitchbeta.net/demorp6/reportes/visor-usecase.php?&saex='

export function SimReportModal({ simId, language, onClose }: Props) {
  const t   = useTranslation(language)
  const es  = language === 'es'
  const url = `${REPORT_BASE}${simId}`
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
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
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line/40 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5 text-accent" />
            </div>
            <span className="text-sm font-semibold text-slate-200 truncate">
              {t('report_title')} <span className="text-slate-500 font-normal">#{simId}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-accent border border-accent/30 hover:bg-accent/10 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {es ? 'Nueva pestaña' : 'New tab'}
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* iframe */}
        <div className="flex-1 relative min-h-0">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card rounded-b-2xl">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              <p className="text-xs text-slate-600">{es ? 'Cargando reporte...' : 'Loading report...'}</p>
            </div>
          )}
          <iframe
            src={url}
            className="w-full h-full border-0 rounded-b-2xl"
            onLoad={() => setLoading(false)}
            title={`${t('report_title')} ${simId}`}
          />
        </div>
      </div>
    </div>
  )
}
