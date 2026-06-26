import type { Activity, Administrator, LineTag, Member, Simulation } from '../api/types'

// re-export so pages can import directly
export type { Simulation }

export const PASS_THRESHOLD = 70

/** Maximum data points returned from computeTrend — prevents chart overload */
const MAX_TREND_POINTS = 60

// ─────────────────────────────────────────────
// Test / demo user filtering
// Test accounts use rolplay.com email domains and "Tester*" / "RolPlay Pruebas*" names.
// This is a client-side backstop; the API also filters them server-side.
// ─────────────────────────────────────────────
const TEST_USER_BLOCKLIST = new Set([
  'Demo User',
  'Piloto 1', 'Piloto 2', 'Piloto 8',
])

function isTestUser(s: Simulation): boolean {
  const name  = s.Usuario_Nombre ?? ''
  const email = (s.Usuario ?? '').toLowerCase()
  if (TEST_USER_BLOCKLIST.has(name)) return true
  if (email.includes('rolplay')) return true
  const nl = name.toLowerCase()
  return nl.startsWith('tester') || nl.startsWith('rolplay pruebas')
}

/** Remove simulations belonging to known test/demo accounts */
export function filterTestUsers(sims: Simulation[]): Simulation[] {
  return sims.filter((s) => !isTestUser(s))
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function pct(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

/** True only for numeric 0/1 interaction values — excludes "No aplica" and null */
function isApplicable(v: unknown): v is number {
  return typeof v === 'number'
}

const INTERACTION_KEYS = ['Puntos_1', 'Puntos_2', 'Puntos_3', 'Puntos_4', 'Puntos_5'] as const

// Calificacion is a 0-100 percentage; null means unscored — exclude from average
function avgScore(sims: Simulation[]): number {
  const valid = sims
    .filter((s) => s.Calificacion !== null && s.Calificacion !== undefined)
    .map((s) => Number(s.Calificacion))
    .filter((n) => Number.isFinite(n))
  if (!valid.length) return 0
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

/**
 * Downsamples an array to at most `maxPoints` entries by evenly skipping elements.
 * Preserves the first and last points for accurate axis bounds.
 */
function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr
  const step = Math.ceil(arr.length / maxPoints)
  const result: T[] = []
  for (let i = 0; i < arr.length; i++) {
    if (i % step === 0 || i === arr.length - 1) result.push(arr[i])
  }
  return result
}

// ─────────────────────────────────────────────
// Quick KPIs — sims only, no org data needed
// Available the instant the simulations query resolves.
// Powers the 4 main OverviewPage KPI cards before org data arrives.
// ─────────────────────────────────────────────

export interface QuickKPIs {
  totalSimulations: number
  averageScore:     number
  passRate:         number
  activeAdvisors:   number
  passCount:        number
  failCount:        number
  bestScore:        number
  worstScore:       number
}

/** O(N) — derives the 4 primary KPIs from simulations only. No org data required. */
export function computeQuickKPIs(sims: Simulation[]): QuickKPIs {
  const passCount = sims.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
  const advisors  = new Set(sims.map((s) => s.Usuario_Nombre).filter(Boolean))
  let bestScore  = 0
  let worstScore = 0
  const scored = sims.filter((s) => s.Calificacion !== null && s.Calificacion !== undefined)
  if (scored.length) {
    bestScore  = scored.reduce((m, s) => Math.max(m, s.Calificacion as number), -Infinity)
    worstScore = scored.reduce((m, s) => Math.min(m, s.Calificacion as number),  Infinity)
    if (!Number.isFinite(bestScore))  bestScore  = 0
    if (!Number.isFinite(worstScore)) worstScore = 0
  }
  return {
    totalSimulations: sims.length,
    averageScore:     avgScore(sims),
    passRate:         pct(passCount, sims.length),
    activeAdvisors:   advisors.size,
    passCount,
    failCount:  sims.length - passCount,
    bestScore,
    worstScore,
  }
}

// ─────────────────────────────────────────────
// Core KPIs
// ─────────────────────────────────────────────

export interface DashboardKPIs {
  totalSimulations: number
  averageScore: number
  passRate: number
  activeAdvisors: number
  totalActivities: number
  totalMembers: number
  totalAdmins: number
  totalSupervisors: number
  bestScore: number
  worstScore: number
  passCount: number
  failCount: number
}

export function computeKPIs(
  sims: Simulation[],
  activities: Activity[],
  members: Member[],
  admins: Administrator[],
): DashboardKPIs {
  const passCount = sims.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
  const advisors  = new Set(sims.map((s) => s.Usuario_Nombre).filter(Boolean))

  // Use Math.max/min with reduce to avoid stack overflow on large arrays
  let bestScore  = 0
  let worstScore = 0
  const scored = sims.filter((s) => s.Calificacion !== null && s.Calificacion !== undefined)
  if (scored.length) {
    bestScore  = scored.reduce((m, s) => Math.max(m, s.Calificacion as number), -Infinity)
    worstScore = scored.reduce((m, s) => Math.min(m, s.Calificacion as number),  Infinity)
    if (!Number.isFinite(bestScore))  bestScore  = 0
    if (!Number.isFinite(worstScore)) worstScore = 0
  }

  return {
    totalSimulations: sims.length,
    averageScore:     avgScore(sims),
    passRate:         pct(passCount, sims.length),
    activeAdvisors:   advisors.size,
    totalActivities:  activities.length,
    // Prefer the count field from the API response when available
    totalMembers:     members.length,
    totalAdmins:      admins.filter((a) => a.rpa_profile_type === 'admin').length,
    totalSupervisors: admins.filter((a) => a.rpa_profile_type === 'supervisor').length,
    bestScore,
    worstScore,
    passCount,
    failCount: sims.length - passCount,
  }
}

// ─────────────────────────────────────────────
// Score Distribution
// ─────────────────────────────────────────────

export interface ScoreBucket {
  label: string
  count: number
  min: number
  max: number
}

export function computeScoreDistribution(sims: Simulation[]): ScoreBucket[] {
  const buckets: ScoreBucket[] = [
    { label: '0–20',   min: 0,  max: 20,  count: 0 },
    { label: '21–40',  min: 21, max: 40,  count: 0 },
    { label: '41–60',  min: 41, max: 60,  count: 0 },
    { label: '61–80',  min: 61, max: 80,  count: 0 },
    { label: '81–100', min: 81, max: 100, count: 0 },
  ]
  sims.forEach((s) => {
    if (s.Calificacion === null || s.Calificacion === undefined) return
    const b = buckets.find((bk) => (s.Calificacion as number) >= bk.min && (s.Calificacion as number) <= bk.max)
    if (b) b.count++
  })
  return buckets
}

// ─────────────────────────────────────────────
// Trend over time (downsampled to MAX_TREND_POINTS)
// ─────────────────────────────────────────────

export interface TrendPoint {
  date: string
  avgScore: number
  count: number
  passRate: number
}

export function computeTrend(sims: Simulation[]): TrendPoint[] {
  const byDate: Record<string, Simulation[]> = {}
  sims.forEach((s) => {
    const date = s.Fecha_y_Hora.substring(0, 10)
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(s)
  })

  const sorted = Object.entries(byDate)
    .map(([date, group]) => ({
      date,
      avgScore: Math.round(avg(group.map((s) => s.Calificacion ?? 0))),
      count:    group.length,
      passRate: pct(
        group.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length,
        group.length,
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Cap at MAX_TREND_POINTS so Recharts never renders more than 60 data points
  return downsample(sorted, MAX_TREND_POINTS)
}

// ─────────────────────────────────────────────
// Round-level averages (Puntos_1..5)
// ─────────────────────────────────────────────

export interface RoundStat {
  round: number
  label: string
  avg: number
  passRate: number
  count: number
}

export function computeRoundStats(sims: Simulation[]): RoundStat[] {
  return [1, 2, 3, 4, 5].map((i) => {
    const key    = `Puntos_${i}` as keyof Simulation
    const values = sims.map((s) => s[key]).filter(isApplicable)
    return {
      round:    i,
      label:    `I${i}`,
      avg:      values.length ? Math.round(avg(values) * 100) / 100 : 0,
      passRate: values.length ? pct(values.filter((v) => v > 0).length, values.length) : 0,
      count:    values.length,
    }
  }).filter((r) => r.count > 0)
}

// ─────────────────────────────────────────────
// Activity statistics
// ─────────────────────────────────────────────

export interface ActivityStat {
  id: number
  name: string
  activityType: string
  count: number
  avgScore: number
  passRate: number
  passCount: number
  failCount: number
}

export function computeActivityStats(
  sims: Simulation[],
  activities: Activity[],
): ActivityStat[] {
  const actMap = new Map(activities.map((a) => [a.ID_Caso_de_Uso, a]))
  const byActivity: Record<number, Simulation[]> = {}

  sims.forEach((s) => {
    if (!byActivity[s.ID_Caso_de_Uso]) byActivity[s.ID_Caso_de_Uso] = []
    byActivity[s.ID_Caso_de_Uso].push(s)
  })

  return Object.entries(byActivity).map(([id, group]) => {
    const numId     = Number(id)
    const act       = actMap.get(numId)
    const passCount = group.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
    return {
      id:           numId,
      name:         act?.Caso_de_Uso     ?? `Activity ${id}`,
      activityType: act?.Actividad_Nombre ?? 'unknown',
      count:        group.length,
      avgScore:     avgScore(group),
      passRate:     pct(passCount, group.length),
      passCount,
      failCount: group.length - passCount,
    }
  })
}

// ─────────────────────────────────────────────
// User (advisor) statistics — leaderboard
// ─────────────────────────────────────────────

export interface UserStat {
  name: string
  userId: string | null
  count: number
  avgScore: number
  passRate: number
  bestScore: number
  passCount: number
}

export function computeUserStats(sims: Simulation[]): UserStat[] {
  const byUser: Record<string, Simulation[]> = {}
  sims.forEach((s) => {
    const key = s.Usuario_Nombre || s.Usuario || 'Unknown'
    if (!byUser[key]) byUser[key] = []
    byUser[key].push(s)
  })

  return Object.entries(byUser)
    .map(([name, group]) => {
      const passCount = group.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
      // Use reduce to avoid stack overflow on large groups
      const bestScore = group.reduce((m, s) => Math.max(m, s.Calificacion ?? 0), 0)
      return {
        name,
        userId:    group[0].Usuario,
        count:     group.length,
        avgScore:  avgScore(group),
        passRate:  pct(passCount, group.length),
        bestScore,
        passCount,
      }
    })
    .sort((a, b) => b.avgScore - a.avgScore)
}

// ─────────────────────────────────────────────
// Organization hierarchy
// ─────────────────────────────────────────────

export interface OrgNode {
  id: number
  name: string
  email: string
  type: string
  parentId: number
  children: OrgNode[]
  memberCount: number
}

export function buildOrgTree(admins: Administrator[], members: Member[]): OrgNode[] {
  const adminMemberCount = new Map<number, number>()
  members.forEach((m) => {
    adminMemberCount.set(m.mb_admin, (adminMemberCount.get(m.mb_admin) ?? 0) + 1)
  })

  const nodes = new Map<number, OrgNode>(
    admins.map((a) => [
      a.rpa_id,
      {
        id:          a.rpa_id,
        name:        a.rpa_full_name,
        email:       a.rpa_email,
        type:        a.rpa_profile_type,
        parentId:    a.rpa_parent,
        children:    [],
        memberCount: adminMemberCount.get(a.rpa_id) ?? 0,
      },
    ]),
  )

  const roots: OrgNode[] = []
  nodes.forEach((node) => {
    const parent = nodes.get(node.parentId)
    if (parent && node.parentId !== 0) {
      parent.children.push(node)
    } else if (node.type === 'supervisor' || node.type === 'tenant') {
      roots.push(node)
    }
  })
  return roots
}

// ─────────────────────────────────────────────
// Coaching feedback analysis — lazy, on-demand only
// ─────────────────────────────────────────────

export interface FeedbackEntry {
  simId: number
  userName: string | null
  round: number
  question: string
  response: string
  feedback: string
  points: number
}

/**
 * Extracts per-interaction feedback from simulations.
 * NOT called eagerly — must be explicitly invoked (drilldown, export, etc.).
 * O(5N) — expensive on large datasets.
 */
export function extractFeedback(sims: Simulation[]): FeedbackEntry[] {
  const entries: FeedbackEntry[] = []
  sims.forEach((s) => {
    for (let i = 1; i <= 5; i++) {
      const puntos   = s[`Puntos_${i}` as keyof Simulation]
      if (!isApplicable(puntos)) continue
      const feedback = s[`Retroalimentacion_${i}` as keyof Simulation] as string | null
      if (!feedback) continue
      entries.push({
        simId:    s.ID_Sim,
        userName: s.Usuario_Nombre,
        round:    i,
        question: (s[`Pregunta_${i}` as keyof Simulation] as string | null) ?? '',
        response: (s[`Respuesta_${i}` as keyof Simulation] as string | null) ?? '',
        feedback,
        points: puntos,
      })
    }
  })
  return entries
}

// ─────────────────────────────────────────────
// Line (Dim_Line / tag1) statistics
// ─────────────────────────────────────────────

export interface LineStat {
  id: number
  name: string
  memberCount: number
  simCount: number
  avgScore: number
  passRate: number
  passCount: number
  activeUsers: number
}

export function computeLineStats(
  lines: LineTag[],
  members: Member[],
  sims: Simulation[],
): LineStat[] {
  const membersByLine = new Map<number, Member[]>()
  members.forEach((m) => {
    if (!m.mb_idTag1) return
    if (!membersByLine.has(m.mb_idTag1)) membersByLine.set(m.mb_idTag1, [])
    membersByLine.get(m.mb_idTag1)!.push(m)
  })

  const userToLine = new Map<string, number>()
  members.forEach((m) => {
    if (m.mb_idTag1 && m.mb_user) userToLine.set(m.mb_user.toLowerCase(), m.mb_idTag1)
  })

  const simsByLine = new Map<number, Simulation[]>()
  sims.forEach((s) => {
    if (!s.Usuario) return
    const lineId = userToLine.get(s.Usuario.toLowerCase())
    if (!lineId) return
    if (!simsByLine.has(lineId)) simsByLine.set(lineId, [])
    simsByLine.get(lineId)!.push(s)
  })

  return lines.map((line) => {
    const lineMembers = membersByLine.get(line.id) ?? []
    const lineSims    = simsByLine.get(line.id)    ?? []
    const passCount   = lineSims.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
    const scores      = lineSims.filter((s) => s.Calificacion !== null && s.Calificacion !== undefined).map((s) => Number(s.Calificacion)).filter((n) => Number.isFinite(n))
    return {
      id:          line.id,
      name:        line.name,
      memberCount: lineMembers.length,
      simCount:    lineSims.length,
      avgScore:    scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      passRate:    lineSims.length ? Math.round((passCount / lineSims.length) * 100) : 0,
      passCount,
      activeUsers: new Set(lineSims.map((s) => s.Usuario_Nombre).filter(Boolean)).size,
    }
  }).sort((a, b) => b.simCount - a.simCount)
}

// ─────────────────────────────────────────────
// AI Context String (for Gemini)
// ─────────────────────────────────────────────

export function buildAIContext(
  kpis: DashboardKPIs,
  sims: Simulation[],
  activities: Activity[],
  actStats: ActivityStat[],
  userStats: UserStat[],
  objections: import('../api/types').ObjectionStat[] = [],
): string {
  const topUsers = userStats.slice(0, 5).map((u) => `${u.name} (${u.avgScore}%)`).join(', ')
  const actList  = actStats.map((a) => `${a.name}: ${a.count} sims, avg ${a.avgScore}%`).join('; ')
  // Pass only last 5 sims — avoid serializing the full dataset into the AI context
  const recent   = sims.slice(-5).map((s) => `${s.Usuario_Nombre}: ${s.Calificacion !== null && s.Calificacion !== undefined ? `${s.Calificacion}%` : '—'} (${s.Diagnostico_Final})`).join(', ')
  const actNames = activities.slice(0, 20).map((a) => a.Caso_de_Uso).join(', ')
  const worst5   = objections.slice(0, 5).map((o, i) => `  ${i + 1}. "${o.objection_text}" — asked ${o.count}x, ${o.pass_rate}% success`).join('\n')
  const best5    = [...objections].reverse().slice(0, 5).map((o, i) => `  ${i + 1}. "${o.objection_text}" — asked ${o.count}x, ${o.pass_rate}% success`).join('\n')

  return `
M8 PHARMA SALES TRAINING INTELLIGENCE PLATFORM — LIVE DASHBOARD DATA
---------------------------------------------------------------------
Total Simulations: ${kpis.totalSimulations}
Average Score: ${kpis.averageScore}%
Pass Rate: ${kpis.passRate}% (${kpis.passCount} passed, ${kpis.failCount} failed)
Active Users: ${kpis.activeAdvisors}
Total Members: ${kpis.totalMembers}
Total Admins: ${kpis.totalAdmins}
Total Supervisors: ${kpis.totalSupervisors}
Best Score: ${kpis.bestScore}%
Lowest Score: ${kpis.worstScore}%

Activities (top 20):
${actList}

Top Performers:
${topUsers}

Recent Simulations (last 5):
${recent}

Activities Available (sample): ${actNames}

OBJECTION HANDLING ("Manejo de Objeciones"):
Definition — Success Rate = % of sessions where the rep scored full points on that specific doctor objection.
Total unique objections tracked: ${objections.length}
${objections.length > 0 ? `Hardest objections (sorted worst-first):\n${worst5}\nEasiest objections:\n${best5}` : 'No objection data available for the current date range.'}
  `.trim()
}
