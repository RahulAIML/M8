import { useMemo } from 'react'
import { useSimulations, useMembers } from '../api/queries'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { filterTestUsers } from '../lib/analytics'
import { CERT_LINES, CERT_WINDOW, CERT_TOTAL_SLOTS, CERT_JEFES } from '../lib/certification'
import { cn } from '../lib/cn'
import {
  BadgeCheck, CalendarRange, GitBranch, Layers, PlayCircle, Users, CheckCircle2, Award,
} from 'lucide-react'

// Certified = above 80% on EACH of the line's 3 assigned simulators (best
// attempt per simulator) within the certification window.
const CERT_SCORE_BAR = 80

interface CertifiedAdvisor {
  email: string
  name: string
  scores: number[]   // best score per assigned sim, in slot order
}

interface LineProgress {
  tagId: number
  name: string
  jefe: string
  memberCount: number
  expected: number       // members × 3 assigned sims
  completed: number      // distinct (advisor, assigned sim) pairs with a session
  passed: number         // of those, pairs whose best session passed
  sessions: number       // raw session count on the line's sims (line members only)
  certified: CertifiedAdvisor[]
  simStats: { product: string; saexId: number; sessions: number; passed: number }[]
}

export default function CertificationPage() {
  const language = useAppStore((s) => s.language)
  const t  = useTranslation(language)
  const es = language === 'es'

  // Fixed certification window — independent of the global dashboard filter
  const simsQ    = useSimulations(CERT_WINDOW.from, CERT_WINDOW.to)
  const membersQ = useMembers()

  const isLoading = simsQ.isLoading || membersQ.isLoading
  const sims      = useMemo(() => filterTestUsers(simsQ.data ?? []), [simsQ.data])
  const members   = membersQ.data ?? []

  const lines: LineProgress[] = useMemo(() => {
    // line tagId → active member emails (lowercased) — excludes internal accounts
    const membersByLine = new Map<number, Set<string>>()
    for (const m of members) {
      if (m.mb_status !== 1 || !m.mb_idTag1 || !m.mb_user) continue
      const email = m.mb_user.toLowerCase()
      if (email.includes('rolplay')) continue
      if (!membersByLine.has(m.mb_idTag1)) membersByLine.set(m.mb_idTag1, new Set())
      membersByLine.get(m.mb_idTag1)!.add(email)
    }

    // (email|simId) → best outcome within the window
    const pairPassed = new Map<string, boolean>()
    const simsById   = new Map<number, { sessions: number; passedUsers: Set<string> }>()
    const bestScore  = new Map<string, Map<number, number>>()  // email → simId → best %
    const advisorName = new Map<string, string>()
    for (const s of sims) {
      const email = (s.Usuario ?? '').toLowerCase()
      if (!email) continue
      if (s.Usuario_Nombre) advisorName.set(email, s.Usuario_Nombre)
      const key  = `${email}|${s.ID_Caso_de_Uso}`
      const pass = s.Diagnostico_Final?.toLowerCase() === 'si'
      pairPassed.set(key, (pairPassed.get(key) ?? false) || pass)
      if (!bestScore.has(email)) bestScore.set(email, new Map())
      const mine = bestScore.get(email)!
      mine.set(s.ID_Caso_de_Uso, Math.max(mine.get(s.ID_Caso_de_Uso) ?? 0, s.Calificacion))
      if (!simsById.has(s.ID_Caso_de_Uso)) simsById.set(s.ID_Caso_de_Uso, { sessions: 0, passedUsers: new Set() })
      const agg = simsById.get(s.ID_Caso_de_Uso)!
      agg.sessions++
      if (pass) agg.passedUsers.add(email)
    }

    return CERT_LINES.map((line) => {
      const lineMembers = membersByLine.get(line.tagId) ?? new Set<string>()
      let completed = 0
      let passed    = 0
      let sessions  = 0
      for (const email of lineMembers) {
        for (const sim of line.sims) {
          const v = pairPassed.get(`${email}|${sim.saexId}`)
          if (v !== undefined) { completed++; if (v) passed++ }
        }
      }
      for (const s of sims) {
        const email = (s.Usuario ?? '').toLowerCase()
        if (lineMembers.has(email) && line.sims.some((x) => x.saexId === s.ID_Caso_de_Uso)) sessions++
      }
      // Certified advisors: anyone whose best attempt exceeds the bar on all
      // 3 of this line's sims — exercise-based, so roster gaps can't hide them.
      const certified: CertifiedAdvisor[] = []
      for (const [email, mine] of bestScore) {
        if (line.sims.every((x) => (mine.get(x.saexId) ?? 0) > CERT_SCORE_BAR)) {
          certified.push({
            email,
            name:   advisorName.get(email) ?? email,
            scores: line.sims.map((x) => mine.get(x.saexId) ?? 0),
          })
        }
      }
      certified.sort((a, b) => a.name.localeCompare(b.name))
      return {
        tagId:       line.tagId,
        name:        line.name,
        jefe:        line.jefe,
        memberCount: lineMembers.size,
        expected:    lineMembers.size * 3,
        completed,
        passed,
        sessions,
        certified,
        simStats: line.sims.map((sim) => ({
          product:  sim.product,
          saexId:   sim.saexId,
          sessions: simsById.get(sim.saexId)?.sessions ?? 0,
          passed:   simsById.get(sim.saexId)?.passedUsers.size ?? 0,
        })),
      }
    })
  }, [sims, members])

  const totals = useMemo(() => {
    const expected  = lines.reduce((a, l) => a + l.expected, 0)
    const completed = lines.reduce((a, l) => a + l.completed, 0)
    const passed    = lines.reduce((a, l) => a + l.passed, 0)
    // distinct emails — an advisor certifying under two lines counts once
    const certifiedPeople = new Set(lines.flatMap((l) => l.certified.map((c) => c.email))).size
    return {
      expected,
      completed,
      passed,
      certifiedPeople,
      sessions: sims.length,
      pct:      expected ? Math.round((completed / expected) * 100) : 0,
      passPct:  completed ? Math.round((passed / completed) * 100) : 0,
    }
  }, [lines, sims])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 skeleton rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card p-5 h-24 skeleton rounded-xl" />)}
        </div>
        <div className="card p-5 h-96 skeleton rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight flex items-center gap-2">
            <BadgeCheck className="w-6 h-6 text-accent" />
            {t('cert_title')}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('cert_subtitle')}</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-full">
          <CalendarRange className="w-3.5 h-3.5" />
          {t('cert_window_badge')}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <CertKpi icon={GitBranch}    label={t('cert_kpi_lines')}     value={CERT_LINES.length} />
        <CertKpi icon={Layers}       label={t('cert_kpi_exercises')} value={CERT_TOTAL_SLOTS} />
        <CertKpi icon={Users}        label={t('cert_kpi_jefes')}     value={CERT_JEFES.length} />
        <CertKpi icon={PlayCircle}   label={t('cert_kpi_sessions')}  value={totals.sessions} />
        <CertKpi icon={CheckCircle2} label={t('cert_kpi_passrate')}  value={`${totals.passPct}%`} />
        <CertKpi icon={Award}        label={t('cert_kpi_certified')} value={totals.certifiedPeople} highlight />
      </div>

      {/* Global progress */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <h3 className="text-sm font-semibold text-slate-200">{t('cert_progress')}</h3>
          <span className="text-xs text-slate-500">
            {totals.completed} / {totals.expected} · <span className="text-accent font-semibold">{totals.pct}%</span> {t('cert_completed')}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-surface overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${totals.pct}%` }} />
        </div>
        <p className="text-[11px] text-slate-600 mt-2">{t('cert_legend')}</p>
      </div>

      {/* Certified advisors — count + names grouped by line */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Award className="w-4 h-4 text-success" />
            {t('cert_certified_title')}
            <span className="text-success font-bold tabular-nums">{totals.certifiedPeople}</span>
          </h3>
        </div>
        <p className="text-[11px] text-slate-600 mb-4">{t('cert_certified_def')}</p>
        {totals.certifiedPeople === 0 ? (
          <p className="text-sm text-slate-500">{t('cert_certified_none')}</p>
        ) : (
          <div className="space-y-4">
            {lines.filter((l) => l.certified.length > 0).map((line) => (
              <div key={line.tagId}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">{line.name}</span>
                  <span className="text-[10px] text-slate-600">({line.jefe})</span>
                  <span className="text-[10px] font-bold text-success tabular-nums">{line.certified.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {line.certified.map((c) => (
                    <span
                      key={c.email}
                      className="inline-flex items-center gap-1.5 text-xs bg-success/5 border border-success/20 text-slate-300 rounded-full pl-2.5 pr-1.5 py-1"
                    >
                      {c.name}
                      <span className="text-[10px] font-semibold text-success bg-success/10 rounded-full px-1.5 py-0.5 tabular-nums">
                        {c.scores.join(' · ')}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignment matrix grouped by jefe */}
      {CERT_JEFES.map((jefe) => (
        <div key={jefe} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            {es ? 'Jefe de Capacitación' : 'Training Chief'}: <span className="text-slate-300">{jefe}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lines.filter((l) => l.jefe === jefe).map((line) => {
              const pct = line.expected ? Math.round((line.completed / line.expected) * 100) : 0
              return (
                <div key={line.tagId} className="card p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-slate-100 capitalize truncate">{line.name}</span>
                      <span className="text-[10px] text-slate-600 shrink-0">
                        {line.memberCount} {t('cert_col_members').toLowerCase()}
                      </span>
                      {line.certified.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-success shrink-0" title={t('cert_kpi_certified')}>
                          <Award className="w-3 h-3" />{line.certified.length}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      'text-xs font-bold shrink-0 tabular-nums',
                      pct >= 100 ? 'text-success' : pct > 0 ? 'text-accent' : 'text-slate-600',
                    )}>{pct}%</span>
                  </div>

                  <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-3">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-500', pct >= 100 ? 'bg-success' : 'bg-accent')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    {line.simStats.map((sim) => (
                      <div key={`${sim.saexId}-${sim.product}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-400 min-w-0">
                          <span className="truncate">{sim.product}</span>
                          <span className="text-slate-700 shrink-0">#{sim.saexId}</span>
                        </span>
                        <span className="text-slate-600 shrink-0 tabular-nums">
                          {sim.sessions} {t('cert_sessions')}
                          {sim.passed > 0 && <span className="text-success"> · {sim.passed} ✓</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function CertKpi({ icon: Icon, label, value, highlight = false }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className={highlight ? 'card p-4 border border-success/30' : 'card p-4'}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${highlight ? 'bg-success/10' : 'bg-accent/10'}`}>
          <Icon className={`w-4 h-4 ${highlight ? 'text-success' : 'text-accent'}`} />
        </div>
        <div className="min-w-0">
          <p className={`text-lg font-bold leading-tight tabular-nums ${highlight ? 'text-success' : 'text-slate-100'}`}>{value}</p>
          <p className="text-[11px] text-slate-500 truncate">{label}</p>
        </div>
      </div>
    </div>
  )
}
