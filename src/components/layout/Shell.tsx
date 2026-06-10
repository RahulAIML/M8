import { lazy, memo, Suspense, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AiBubble } from '../ai/AiBubble'
import { LoadingBanner } from '../ui/LoadingBanner'
import { useAppStore } from '../../store'

/**
 * AIAssistant panel — lazy-loaded AND conditionally mounted.
 *
 * Why both?
 * - `lazy()` defers the module download until first use.
 * - The `{aiOpen && …}` guard ensures React never mounts the component at all
 *   until the user explicitly opens the panel, preventing:
 *     • useDashboardData subscription on startup
 *     • Framer Motion spring physics initialization
 *     • 5 useState / 4 useRef allocations
 *     • paste / keyboard event listener registration
 *
 * AiBubble is always in the tree — it is tiny (no data deps, ~200 B gzipped).
 */
const AIAssistantPanel = lazy(() =>
  import('../ai/AIAssistant').then((m) => ({ default: m.AIAssistant })),
)

export const Shell = memo(function Shell({ children }: { children: React.ReactNode }) {
  const theme           = useAppStore((s) => s.theme)
  const aiOpen          = useAppStore((s) => s.aiOpen)
  const mobileMenuOpen  = useAppStore((s) => s.mobileMenuOpen)
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen)

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') html.classList.add('dark')
    else html.classList.remove('dark')
  }, [theme])

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {/* Mobile overlay — sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <LoadingBanner />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3 sm:p-5 lg:p-6 pb-6 max-w-[1600px] mx-auto page-fade">
            {children}
          </div>
        </main>
      </div>

      {/* Always-visible floating button — zero data deps, tiny bundle cost */}
      <AiBubble />

      {/* Full panel — mounts ONLY when user opens it, unmounts when closed */}
      {aiOpen && (
        <Suspense fallback={null}>
          <AIAssistantPanel />
        </Suspense>
      )}
    </div>
  )
})
