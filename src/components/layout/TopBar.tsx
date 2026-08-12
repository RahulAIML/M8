import { memo, useState } from 'react'
import { Globe, RefreshCw, Menu, ChevronDown, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore, type Language } from '../../store'
import { useTranslation } from '../../lib/i18n'
import { useAuthContext } from '../AuthProvider'
import { cn } from '../../lib/cn'

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: 'es', label: 'ES', flag: '🇲🇽' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
]

export const TopBar = memo(function TopBar() {
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const toggleMobileMenu = useAppStore((s) => s.toggleMobileMenu)
  const t = useTranslation(language)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user, logout } = useAuthContext()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 shadow-sm">
      {/* Left: hamburger (mobile) + logo + company name + title */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-gray-100 transition-colors"
          title="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <h1 className="text-slate-800 font-bold text-lg">
          {language === 'es' ? 'Plataforma de Análisis M8' : 'M8 Analytics Platform'}
        </h1>
      </div>

      {/* Right: refresh + language + user */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => queryClient.invalidateQueries()}
          title="Refresh data"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Language switcher */}
        <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1">
          <Globe className="w-3.5 h-3.5 text-gray-400 ml-1" />
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={cn(
                'px-2 py-0.5 rounded-md text-xs font-medium transition-all duration-150',
                language === l.code
                  ? 'bg-accent text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-gray-100',
              )}
            >
              <span className="mr-0.5">{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 border-l border-gray-200 hover:bg-gray-50 rounded-lg py-1 px-2 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <span className="text-accent text-xs font-bold">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-slate-700 text-xs font-semibold leading-tight">
                {user?.full_name || 'User'}
              </span>
              <span className="text-slate-400 text-[10px] leading-tight">{user?.email}</span>
            </div>
            <ChevronDown className={cn(
              'w-3.5 h-3.5 text-gray-400 transition-transform',
              showUserMenu && 'rotate-180'
            )} />
          </button>

          {/* Dropdown menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-slate-700">{user?.full_name || 'User'}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
})
