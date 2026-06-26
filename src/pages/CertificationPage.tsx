import { useMemo } from 'react'
import { useSimulations } from '../api/queries'
import { useAppStore } from '../store'
import { filterTestUsers } from '../lib/analytics'
import { M8_EXERCISES, CERT_WINDOW, CERT_SCORE_BAR } from '../lib/certification'
import { cn } from '../lib/cn'
import { BadgeCheck, Award, ExternalLink } from 'lucide-react'

export default function CertificationPage() {
  useAppStore((s) => s.language)

  const simsQ = useSimulations(CERT_WINDOW.from, CERT_WINDOW.to)
  const sims  = useMemo(() => filterTestUsers(simsQ.data ?? []), [simsQ.data])

  // Per-exercise stats
  const exerciseStats = useMemo(() => M8_EXERCISES.map((ex) => {
    const exSims    = sims.filter((s) => s.ID_Caso_de_Uso === ex.saexId)
    const passCount = exSims.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
    const scores    = exSims.map((s) => s.Calificacion != null ? Number(s.Calificacion) : null).filter((n): n is number => n !== null && Number.isFinite(n))
    return {
      ...ex,
      sessions:       exSims.length,
      avgScore:       scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      passRate:       exSims.length ? Math.round((passCount / exSims.length) * 100) : 0,
      passCount,
      uniqueAdvisors: new Set(exSims.map((s) => s.Usuario).filter(Boolean)).size,
    }
  }), [sims])

  // Best score per advisor per exercise
  const bestScoreMap = useMemo(() => {
    const map = new Map<string, { name: string; scores: Map<number, number> }>()
    for (const s of sims) {
      const em = (s.Usuario ?? '').toLowerCase()
      if (!em) continue
      if (s.Calificacion === null || s.Calificacion === undefined) continue
      if (!map.has(em)) map.set(em, { name: s.Usuario_Nombre ?? em, scores: new Map() })
      const entry = map.get(em)!
      if (s.Usuario_Nombre) entry.name = s.Usuario_Nombre
      entry.scores.set(s.ID_Caso_de_Uso, Math.max(entry.scores.get(s.ID_Caso_de_Uso) ?? 0, Number(s.Calificacion)))
    }
    return map
  }, [sims])

  // Certified = ≥CERT_SCORE_BAR on every M8 exercise
  const certified = useMemo(() => {
    const allIds = M8_EXERCISES.map((e) => e.saexId)
    const result: { email: string; name: string; scores: number[] }[] = []
    for (const [email, data] of bestScoreMap) {
      if (allIds.every((id) => (data.scores.get(id) ?? 0) >= CERT_SCORE_BAR)) {
        result.push({ email, name: data.name, scores: allIds.map((id) => data.scores.get(id) ?? 0) })
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [bestScoreMap])

  const totalSessions = exerciseStats.reduce((a, e) => a + e.sessions, 0)

  if (simsQ.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 skeleton rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card p-5 h-32 skeleton rounded-xl" />)}
        </div>
        <div className="card p-5 h-48 skeleton rounded-xl" />
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
            Certificación M8 Pharma
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Legalon · Abcito · Coach Combinado</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-surface border border-slate-800 px-3 py-1.5 rounded-full">
          <span className="tabular-nums font-semibold text-slate-200">{totalSessions}</span> sesiones ·
          <span className="tabular-nums font-semibold text-success">{certified.length}</span> certificados ·
          <span className="text-slate-500">≥{CERT_SCORE_BAR}% en {M8_EXERCISES.length} ejercicios</span>
        </div>
      </div>

      {/* Exercise cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {exerciseStats.map((ex) => (
          <div key={ex.saexId} className="card p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 leading-snug">{ex.product}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium',
                    ex.type === 'Coach'
                      ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                      : 'bg-accent/10 text-accent border border-accent/20',
                  )}>
                    {ex.type}
                  </span>
                  <span className="text-[10px] text-slate-600">#{ex.saexId}</span>
                </div>
              </div>
              <a
                href={ex.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-slate-600 hover:text-accent transition-colors"
                title="Abrir ejercicio"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-base font-bold text-slate-100 tabular-nums">{ex.sessions}</p>
                <p className="text-[10px] text-slate-500">sesiones</p>
              </div>
              <div>
                <p className="text-base font-bold text-slate-100 tabular-nums">{ex.sessions && ex.avgScore !== null ? `${ex.avgScore}%` : '—'}</p>
                <p className="text-[10px] text-slate-500">promedio</p>
              </div>
              <div>
                <p className="text-base font-bold text-slate-100 tabular-nums">{ex.uniqueAdvisors}</p>
                <p className="text-[10px] text-slate-500">asesores</p>
              </div>
            </div>

            {ex.sessions > 0 && (
              <>
                <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-500',
                      ex.passRate >= 80 ? 'bg-success' : ex.passRate >= 60 ? 'bg-accent' : 'bg-amber-500')}
                    style={{ width: `${ex.passRate}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 -mt-1">
                  {ex.passCount} aprobados · {ex.passRate}% tasa
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Certified advisors */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Award className="w-4 h-4 text-success" />
          <h3 className="text-sm font-semibold text-slate-200">
            Asesores Certificados
          </h3>
          <span className="text-success font-bold tabular-nums text-sm">{certified.length}</span>
        </div>
        <p className="text-[11px] text-slate-600 mb-4">
          Certificado = ≥{CERT_SCORE_BAR}% en cada uno de los {M8_EXERCISES.length} ejercicios durante el período.
        </p>
        {certified.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay asesores certificados en el período.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {certified.map((c) => (
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
        )}
      </div>
    </div>
  )
}
