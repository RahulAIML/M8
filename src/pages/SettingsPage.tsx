import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { Sun, Moon, Globe, Info } from 'lucide-react'
import { cn } from '../lib/cn'

export default function SettingsPage() {
  const { language, theme, setLanguage, toggleTheme } = useAppStore()
  const t = useTranslation(language)
  const es = language === 'es'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_settings_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_settings_subtitle')}</p>
      </div>

      {/* Appearance */}
      <div className="card p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600">
          {es ? 'Apariencia' : 'Appearance'}
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">{es ? 'Tema' : 'Theme'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{es ? 'Modo claro u oscuro' : 'Light or dark mode'}</p>
          </div>
          <button
            onClick={toggleTheme}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all',
              theme === 'dark'
                ? 'bg-slate-800 border-line text-slate-200 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
            )}
          >
            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === 'dark' ? (es ? 'Oscuro' : 'Dark') : (es ? 'Claro' : 'Light')}
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="card p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600">
          {es ? 'Idioma' : 'Language'}
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">{es ? 'Idioma de la plataforma' : 'Platform language'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{es ? 'Español o Inglés' : 'Spanish or English'}</p>
          </div>
          <div className="flex items-center gap-2">
            {(['es', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all',
                  language === lang
                    ? 'bg-accent/15 border-accent/40 text-accent'
                    : 'bg-surface border-line text-slate-400 hover:text-slate-200',
                )}
              >
                <Globe className="w-3.5 h-3.5" />
                {lang === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Platform info */}
      <div className="card p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-600">
          {es ? 'Plataforma' : 'Platform'}
        </h2>
        <div className="space-y-3">
          {[
            { label: es ? 'Nombre' : 'Name', value: es ? 'Inteligencia de Entrenamiento IA' : 'AI Training Intelligence' },
            { label: es ? 'Versión' : 'Version', value: '2.0.0' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm border-b border-line/20 pb-2 last:border-0 last:pb-0">
              <span className="text-slate-500">{row.label}</span>
              <span className="text-slate-300 font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="flex items-start gap-2 bg-surface border border-line/40 rounded-lg px-4 py-3">
        <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500">
          {es
            ? 'Configuraciones avanzadas de usuarios, permisos y notificaciones estarán disponibles en futuras versiones.'
            : 'Advanced user settings, permissions, and notifications will be available in future versions.'}
        </p>
      </div>
    </div>
  )
}
