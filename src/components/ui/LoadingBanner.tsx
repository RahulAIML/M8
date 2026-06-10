import { useIsFetching } from '@tanstack/react-query'
import { useAppStore } from '../../store'
import { useTranslation } from '../../lib/i18n'

export function LoadingBanner() {
  const isFetching = useIsFetching()
  const language   = useAppStore((s) => s.language)
  const t          = useTranslation(language)

  if (!isFetching) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 px-4 py-2 bg-accent/10 border-b border-accent/20 text-accent text-xs font-medium"
    >
      {/* Spinning ring */}
      <svg
        className="w-3.5 h-3.5 shrink-0 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>

      <span>{t('loading_data')}</span>
      <span className="text-muted text-[11px] hidden sm:inline">
        — {t('loading_data_sub')}
      </span>
    </div>
  )
}
