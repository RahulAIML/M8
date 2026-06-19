import { memo, useState, useEffect } from 'react'
import {
  LayoutDashboard, PlayCircle, MessageSquare, Brain, Trophy,
  Activity, Building2, ChevronLeft, ChevronRight,
  GitBranch, FileText, Settings, X, BadgeCheck,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '../../store'
import { useTranslation } from '../../lib/i18n'
import { cn } from '../../lib/cn'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  key: string
  exact?: boolean
}

const NAV_GROUPS: { labelKey: string; items: NavItem[] }[] = [
  {
    labelKey: 'nav_overview',
    items: [{ to: '/', icon: LayoutDashboard, key: 'nav_overview', exact: true }],
  },
  {
    labelKey: 'nav_simulator',
    items: [
      { to: '/certification', icon: BadgeCheck, key: 'nav_certification' },
      { to: '/simulations', icon: PlayCircle, key: 'nav_simulations' },
      { to: '/conversational', icon: MessageSquare, key: 'nav_conversational' },
      { to: '/coaching', icon: Brain, key: 'nav_coaching' },
      { to: '/leaderboard', icon: Trophy, key: 'nav_leaderboard' },
    ],
  },
  {
    labelKey: 'nav_platform',
    items: [
      { to: '/activities', icon: Activity, key: 'nav_activities' },
      { to: '/organization', icon: Building2, key: 'nav_organization' },
      { to: '/business-lines', icon: GitBranch, key: 'nav_business_lines' },
    ],
  },
  {
    labelKey: 'nav_more',
    items: [
      { to: '/reports', icon: FileText, key: 'nav_reports' },
      { to: '/settings', icon: Settings, key: 'nav_settings' },
    ],
  },
]

const NavContent = memo(function NavContent({
  collapsed,
  onNavClick,
}: {
  collapsed: boolean
  onNavClick?: () => void
}) {
  const language = useAppStore((s) => s.language)
  const t = useTranslation(language)

  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.labelKey}>
          <p className={cn(
            'px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-700 transition-[opacity,height] duration-150 overflow-hidden',
            collapsed ? 'opacity-0 h-0 mb-0' : 'opacity-100 h-4',
          )}>
            {t(group.labelKey)}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={onNavClick}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all duration-150 group relative',
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]',
                  )
                }
                title={collapsed ? t(item.key) : undefined}
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'w-4 h-4 shrink-0 relative z-10 transition-colors',
                        isActive ? 'text-accent' : 'text-slate-600 group-hover:text-slate-300',
                      )}
                    />
                    <span className={cn(
                      'relative z-10 whitespace-nowrap font-medium transition-[opacity] duration-150',
                      collapsed ? 'opacity-0 w-0 overflow-hidden pointer-events-none' : 'opacity-100',
                    )}>
                      {t(item.key)}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
})

export const Sidebar = memo(function Sidebar() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const mobileMenuOpen = useAppStore((s) => s.mobileMenuOpen)
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen)
  const language = useAppStore((s) => s.language)
  const t = useTranslation(language)

  // Animate mobile drawer close without framer-motion
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    if (!mobileMenuOpen) setClosing(false)
  }, [mobileMenuOpen])

  function closeMobile() {
    setClosing(true)
    setTimeout(() => setMobileMenuOpen(false), 220)
  }

  return (
    <>
      {/* ── Desktop sidebar (lg+) ── */}
      <aside
        style={{ width: sidebarCollapsed ? 72 : 240 }}
        className="relative hidden lg:flex flex-col bg-surface border-r border-line/40 h-screen shrink-0 overflow-hidden z-20 transition-[width] duration-200 ease-in-out"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-line/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/m8-logo.svg" height={32} alt="M8 Pharma" className="w-auto shrink-0" style={{ maxHeight: 32 }} />
            <div className={cn(
              'flex flex-col min-w-0 overflow-hidden transition-[opacity,width] duration-150',
              sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100',
            )}>
              <span className="text-slate-100 font-semibold text-sm leading-tight tracking-tight whitespace-nowrap">
                M8 Pharma
              </span>
              <span className="text-slate-600 text-[10px] leading-tight whitespace-nowrap">
                {t('sidebar_tagline')}
              </span>
            </div>
          </div>
        </div>

        <NavContent collapsed={sidebarCollapsed} />

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-surface border border-line flex items-center justify-center text-slate-500 hover:text-slate-200 hover:border-line/80 transition-all z-30 shadow-elevated"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Mobile sidebar drawer (< lg) ── */}
      {(mobileMenuOpen || closing) && (
        <>
          <div
            className={cn(
              'fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-220',
              closing ? 'opacity-0' : 'opacity-100',
            )}
            onClick={closeMobile}
          />
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-[240px] flex flex-col bg-surface border-r border-line/40 lg:hidden',
              closing ? 'translate-x-[-260px] transition-transform duration-[220ms] ease-in' : 'animate-slide-in-left',
            )}
          >
            {/* Logo + close */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-line/30 shrink-0">
              <div className="flex items-center gap-3">
                <img src="/m8-logo.svg" height={28} alt="M8 Pharma" className="w-auto shrink-0" style={{ maxHeight: 28 }} />
                <div className="flex flex-col">
                  <span className="text-slate-100 font-semibold text-sm leading-tight">M8 Pharma</span>
                  <span className="text-slate-600 text-[10px] leading-tight">{t('sidebar_tagline')}</span>
                </div>
              </div>
              <button
                onClick={closeMobile}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <NavContent collapsed={false} onNavClick={closeMobile} />
          </aside>
        </>
      )}
    </>
  )
})
