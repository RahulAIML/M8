import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Shell } from './components/layout/Shell'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ChartSkeleton } from './components/ui/Skeleton'
import { fetchActivities, fetchSimulations, fetchMembers, fetchAdmins } from './api/client'
import { resolveEffectiveDates } from './lib/dateUtils'
import OverviewPage from './pages/OverviewPage'

const SimulationsPage = lazy(() => import('./pages/SimulationsPage'))
const CertificationPage = lazy(() => import('./pages/CertificationPage'))
const ConversationalPage = lazy(() => import('./pages/ConversationalPage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'))
const OrganizationPage = lazy(() => import('./pages/OrganizationPage'))
const CoachingPage = lazy(() => import('./pages/CoachingPage'))
const BusinessLinesPage = lazy(() => import('./pages/BusinessLinesPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const STALE = 5 * 60 * 1000
const GC    = 30 * 60 * 1000

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE,
      gcTime: GC,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

// ─── localStorage cache persistence ───────────────────────────────────────────
// Restores the previous session's API responses so the dashboard feels instant
// on every page load after the first. Fresh data fetches in the background.
// v5: DATA_EPOCH changed to 2026-06-01; objections query added
const CACHE_KEY = 'm8-qc-v1'

function restoreCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    const saved: { ts: number; entries: [readonly unknown[], unknown][] } = JSON.parse(raw)
    // Always restore, no matter how old: stale data paints the UI instantly
    // and React Query (seeing the old updatedAt) refetches in the background.
    // An empty screen is never faster than yesterday's numbers.
    saved.entries.forEach(([key, data]) => {
      queryClient.setQueryData(key, data, { updatedAt: saved.ts })
    })
  } catch { /* corrupt cache — ignore */ }
}

// One oversized entry (a 12-month simulations payload is several MB) would
// overflow the ~5 MB localStorage quota and silently kill persistence for
// everything else — skip any entry bigger than this.
const MAX_PERSISTED_ENTRY_BYTES = 1_500_000

function saveCache() {
  try {
    const entries: [readonly unknown[], unknown][] = []
    for (const q of queryClient.getQueryCache().getAll()) {
      if (q.state.status !== 'success' || q.state.data === undefined) continue
      // simReport entries are per-session one-offs — persisting them bloats quota
      if (q.queryKey[0] === 'simReport') continue
      if (JSON.stringify(q.state.data).length > MAX_PERSISTED_ENTRY_BYTES) continue
      entries.push([q.queryKey, q.state.data])
    }
    if (!entries.length) return
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), entries }))
  } catch { /* localStorage quota — skip */ }
}

// Hydrate React Query cache from localStorage before anything renders
restoreCache()

// Persist to localStorage whenever a query succeeds
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'success') {
    saveCache()
  }
})
// ──────────────────────────────────────────────────────────────────────────────

// Fire all API requests immediately at module load — before React renders anything.
// Combined with cache restore above: if cache is warm, components see data on
// first render; if cold, requests are already in-flight when components mount.
// The simulations key must match useSimulations' default-range key exactly.
const { from: defFrom, to: defTo } = resolveEffectiveDates(null, null)
queryClient.prefetchQuery({ queryKey: ['simulations', defFrom, defTo], queryFn: ({ signal }) => fetchSimulations(defFrom, defTo, signal), staleTime: STALE })
queryClient.prefetchQuery({ queryKey: ['activities'],  queryFn: ({ signal }) => fetchActivities(signal),             staleTime: STALE })
queryClient.prefetchQuery({ queryKey: ['members'],     queryFn: ({ signal }) => fetchMembers(signal),                staleTime: STALE })
queryClient.prefetchQuery({ queryKey: ['admins'],      queryFn: ({ signal }) => fetchAdmins(signal),                 staleTime: STALE })

function PageFallback() {
  return (
    <div className="p-6 space-y-4">
      <ChartSkeleton height={120} />
      <ChartSkeleton height={280} />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell>
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/simulations" element={<SimulationsPage />} />
                <Route path="/certification" element={<CertificationPage />} />
                <Route path="/conversational" element={<ConversationalPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/organization" element={<OrganizationPage />} />
                <Route path="/coaching" element={<CoachingPage />} />
                <Route path="/business-lines" element={<BusinessLinesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Shell>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
