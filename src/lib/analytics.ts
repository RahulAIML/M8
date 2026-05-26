import type { Activity, Administrator, LineTag, Member, Simulation } from '../api/types'
// re-export so pages can import directly
export type { Simulation }

export const PASS_THRESHOLD = 60

// ─────────────────────────────────────────────
// Test / demo user blocklist
// ─────────────────────────────────────────────
const TEST_USER_BLOCKLIST = new Set([
  'Tester Sanfer Demo',
  'Tester Sanfer Grupal',
  'Tester Sanfer Completo',
  'Piloto 1', 'Piloto 2', 'Piloto 8',
  'Sanfer01', 'Demo User',
])

/** Remove simulations belonging to known test/demo accounts */
export function filterTestUsers(sims: Simulation[]): Simulation[] {
  return sims.filter((s) => !TEST_USER_BLOCKLIST.has(s.Usuario_Nombre ?? ''))
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

const INTERACTION_KEYS = ['Puntos_1','Puntos_2','Puntos_3','Puntos_4','Puntos_5'] as const

/** Count of applicable (numeric) interactions for one simulation */
function countApplicable(s: Simulation): number {
  return INTERACTION_KEYS.filter((k) => isApplicable(s[k])).length
}

// Calificacion is a 0-100 percentage; guard against null/non-numeric API values
function avgScore(sims: Simulation[]): number {
  const valid = sims.map((s) => Number(s.Calificacion)).filter((n) => Number.isFinite(n))
  if (!valid.length) return 0
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
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
  const advisors = new Set(sims.map((s) => s.Usuario_Nombre).filter(Boolean))
  const scores = sims.map((s) => s.Calificacion)

  return {
    totalSimulations: sims.length,
    averageScore: avgScore(sims),
    passRate: pct(passCount, sims.length),
    activeAdvisors: advisors.size,
    totalActivities: activities.length,
    totalMembers: members.length,
    totalAdmins: admins.filter((a) => a.rpa_profile_type === 'admin').length,
    totalSupervisors: admins.filter((a) => a.rpa_profile_type === 'supervisor').length,
    bestScore: scores.length ? Math.max(...scores) : 0,
    worstScore: scores.length ? Math.min(...scores) : 0,
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
    { label: '0–20', min: 0, max: 20, count: 0 },
    { label: '21–40', min: 21, max: 40, count: 0 },
    { label: '41–60', min: 41, max: 60, count: 0 },
    { label: '61–80', min: 61, max: 80, count: 0 },
    { label: '81–100', min: 81, max: 100, count: 0 },
  ]
  sims.forEach((s) => {
    const b = buckets.find((bk) => s.Calificacion >= bk.min && s.Calificacion <= bk.max)
    if (b) b.count++
  })
  return buckets
}

// ─────────────────────────────────────────────
// Trend over time
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
    const date = s.Fecha_y_Hora.split('T')[0]
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(s)
  })
  return Object.entries(byDate)
    .map(([date, group]) => ({
      date,
      avgScore: Math.round(avg(group.map((s) => s.Calificacion))),
      count: group.length,
      passRate: pct(
        group.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length,
        group.length,
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ─────────────────────────────────────────────
// Round-level averages (Puntos_1..6)
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
    const key = `Puntos_${i}` as keyof Simulation
    const values = sims
      .map((s) => s[key])
      .filter(isApplicable)            // excludes "No aplica" and null
    return {
      round: i,
      label: `I${i}`,                  // I = Interaction
      avg: values.length ? Math.round(avg(values) * 100) / 100 : 0,
      passRate: values.length ? pct(values.filter((v) => v > 0).length, values.length) : 0,
      count: values.length,
    }
  }).filter((r) => r.count > 0)       // only include interactions that have real data
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
    const numId = Number(id)
    const act = actMap.get(numId)
    const passCount = group.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
    return {
      id: numId,
      name: act?.Caso_de_Uso ?? `Activity ${id}`,
      activityType: act?.Actividad_Nombre ?? 'unknown',
      count: group.length,
      avgScore: avgScore(group),
      passRate: pct(passCount, group.length),
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
      const scores = group.map((s) => s.Calificacion)
      return {
        name,
        userId: group[0].Usuario,
        count: group.length,
        avgScore: avgScore(group),
        passRate: pct(passCount, group.length),
        bestScore: Math.max(...scores),
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
        id: a.rpa_id,
        name: a.rpa_full_name,
        email: a.rpa_email,
        type: a.rpa_profile_type,
        parentId: a.rpa_parent,
        children: [],
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
// Coaching feedback analysis
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

export function extractFeedback(sims: Simulation[]): FeedbackEntry[] {
  const entries: FeedbackEntry[] = []
  sims.forEach((s) => {
    for (let i = 1; i <= 5; i++) {
      const puntos = s[`Puntos_${i}` as keyof Simulation]
      if (!isApplicable(puntos)) continue   // skip "No aplica" and null
      const feedback = s[`Retroalimentacion_${i}` as keyof Simulation] as string | null
      if (!feedback) continue
      entries.push({
        simId: s.ID_Sim,
        userName: s.Usuario_Nombre,
        round: i,
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
// Line (Dim_Line / tag1) statistics — Sanfer-specific
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
  // Group members by their line id (mb_idTag1 === 0 means unassigned)
  const membersByLine = new Map<number, Member[]>()
  members.forEach((m) => {
    if (!m.mb_idTag1) return  // skip unassigned (0 or falsy)
    if (!membersByLine.has(m.mb_idTag1)) membersByLine.set(m.mb_idTag1, [])
    membersByLine.get(m.mb_idTag1)!.push(m)
  })

  // Build user → lineId lookup (mb_user email → line.id)
  const userToLine = new Map<string, number>()
  members.forEach((m) => {
    if (m.mb_idTag1 && m.mb_user) userToLine.set(m.mb_user, m.mb_idTag1)
  })

  // Group sims by line
  const simsByLine = new Map<number, Simulation[]>()
  sims.forEach((s) => {
    if (!s.Usuario) return
    const lineId = userToLine.get(s.Usuario)
    if (!lineId) return
    if (!simsByLine.has(lineId)) simsByLine.set(lineId, [])
    simsByLine.get(lineId)!.push(s)
  })

  return lines.map((line) => {
    const lineMembers = membersByLine.get(line.id) ?? []
    const lineSims = simsByLine.get(line.id) ?? []
    const passCount = lineSims.filter((s) => s.Diagnostico_Final?.toLowerCase() === 'si').length
    const scores = lineSims.map((s) => Number(s.Calificacion)).filter((n) => Number.isFinite(n))
    return {
      id: line.id,
      name: line.name,
      memberCount: lineMembers.length,
      simCount: lineSims.length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      passRate: lineSims.length ? Math.round((passCount / lineSims.length) * 100) : 0,
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
): string {
  const topUsers = userStats.slice(0, 5).map((u) => `${u.name} (${u.avgScore}%)`).join(', ')
  const actList = actStats
    .map((a) => `${a.name}: ${a.count} sims, avg ${a.avgScore}%`)
    .join('; ')
  const recent = sims
    .slice(-5)
    .map((s) => `${s.Usuario_Nombre}: ${s.Calificacion}% (${s.Diagnostico_Final})`)
    .join(', ')

  return `
SANFER SALES TRAINING INTELLIGENCE PLATFORM — LIVE DASHBOARD DATA
------------------------------------------------------------------
Total Simulations: ${kpis.totalSimulations}
Average Score: ${kpis.averageScore}%
Pass Rate: ${kpis.passRate}% (${kpis.passCount} passed, ${kpis.failCount} failed)
Active Users: ${kpis.activeAdvisors}
Total Members: ${kpis.totalMembers}
Total Admins: ${kpis.totalAdmins}
Total Supervisors: ${kpis.totalSupervisors}
Best Score: ${kpis.bestScore}%
Lowest Score: ${kpis.worstScore}%

Activities:
${actList}

Top Performers:
${topUsers}

Recent Simulations (last 5):
${recent}

Activities Available: ${activities.map((a) => a.Caso_de_Uso).join(', ')}
  `.trim()
}
