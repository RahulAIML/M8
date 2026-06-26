import type {
  ActivitiesResponse,
  AdminsResponse,
  LinesResponse,
  MembersResponse,
  ObjectionsResponse,
  SessionDepthRow,
  Simulation,
  SimReport,
} from './types'
import { resolveEffectiveDates } from '../lib/dateUtils'

// Proxied in dev: /m8/bridge → https://rolplay.app/ajax  (vite.config.ts)
const REMOTE = '/m8/bridge/remote-access.php'

// M8 Pharma exercise IDs — Legalon + Abcito (Simulador + Coach) + Combined Coach
const M8_IDS = [3129, 3131, 3132, 3155, 3161]
const M8_CLIENT_ID = 24
const IDS_SQL = M8_IDS.join(',')

/** Extract YYYY-MM-DD from a datetime string regardless of separator. */
export function simDate(fecha: string | null | undefined): string {
  return fecha?.substring(0, 10) ?? ''
}

const entityBox = typeof document !== 'undefined' ? document.createElement('textarea') : null
function decodeEntities(s: string | null | undefined): string {
  if (!s) return ''
  if (!entityBox || !s.includes('&')) return s
  entityBox.innerHTML = s
  return entityBox.value
}

function isInternalEmail(email: string | null | undefined): boolean {
  return /rolplay/i.test(email ?? '')
}

// ─────────────────────────────────────────────
// Core SQL helper
// ─────────────────────────────────────────────

async function remoteSQL<T>(sql: string, signal?: AbortSignal): Promise<T[]> {
  const res = await fetch(REMOTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} — remote-access.php`)
  const json = await res.json()
  if (json.result !== 'success') throw new Error(json.error ?? 'SQL query failed')
  return (json.data ?? []) as T[]
}

// ─────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────

export async function fetchActivities(signal?: AbortSignal): Promise<ActivitiesResponse> {
  const data = await remoteSQL<{ ID_Caso_de_Uso: number; Caso_de_Uso: string; Actividad_Nombre: string }>(
    `SELECT ID AS ID_Caso_de_Uso, name AS Caso_de_Uso, name AS Actividad_Nombre
     FROM r_simulator
     WHERE ID IN (${IDS_SQL})`,
    signal,
  )
  return { ok: true, data, total_records: data.length }
}

export async function fetchSimulations(
  from?: string | null,
  to?: string | null,
  signal?: AbortSignal,
): Promise<Simulation[]> {
  const { from: effFrom, to: effTo } = resolveEffectiveDates(from ?? null, to ?? null)
  const rows = await remoteSQL<Simulation>(
    `SELECT
       s.ID_Sim,
       s.ID_Caso_de_Uso,
       s.Caso_de_Uso,
       s.Usuario,
       s.Usuario_Nombre,
       CASE WHEN s.raw_score IS NULL THEN NULL
            ELSE LEAST(100, GREATEST(0, ROUND(s.raw_score))) END AS Calificacion,
       CASE WHEN s.raw_score IS NOT NULL THEN IF(ROUND(s.raw_score) >= 70, 'si', 'no')
            ELSE NULL END AS Diagnostico_Final,
       s.Fecha_y_Hora,
       CASE WHEN s.raw_score IS NULL THEN NULL
            ELSE LEAST(100, GREATEST(0, ROUND(s.raw_score))) END AS Puntos_Totales,
       NULL AS Pregunta_1, NULL AS Pregunta_2, NULL AS Pregunta_3,
       NULL AS Pregunta_4, NULL AS Pregunta_5, NULL AS Pregunta_6,
       NULL AS Puntos_1,   NULL AS Puntos_2,   NULL AS Puntos_3,
       NULL AS Puntos_4,   NULL AS Puntos_5,   NULL AS Puntos_6,
       NULL AS Respuesta_1,      NULL AS Respuesta_2,      NULL AS Respuesta_3,
       NULL AS Respuesta_4,      NULL AS Respuesta_5,      NULL AS Respuesta_6,
       NULL AS Retroalimentacion_1, NULL AS Retroalimentacion_2,
       NULL AS Retroalimentacion_3, NULL AS Retroalimentacion_4,
       NULL AS Retroalimentacion_5, NULL AS Retroalimentacion_6
     FROM (
       SELECT
         us.ID                AS ID_Sim,
         us.simulator_id      AS ID_Caso_de_Uso,
         rs.name              AS Caso_de_Uso,
         u.email              AS Usuario,
         u.name               AS Usuario_Nombre,
         us.date_created      AS Fecha_y_Hora,
         us.score             AS score_db,
         us.passed_flag       AS passed_flag_db,
         CASE
           WHEN us.score > 0 THEN CAST(us.score AS DECIMAL(10,2))
           WHEN us.raw_closing_data IS NOT NULL AND us.raw_closing_data != ''
             THEN COALESCE(
               CAST(JSON_UNQUOTE(JSON_EXTRACT(us.raw_closing_data, '$.score_bar'))    AS DECIMAL(10,2)),
               CAST(JSON_UNQUOTE(JSON_EXTRACT(us.raw_closing_data, '$.overall_score')) AS DECIMAL(10,2))
             )
           ELSE NULL
         END AS raw_score
       FROM r_user_session us
       JOIN r_user u       ON u.ID  = us.user_id
       JOIN r_simulator rs ON rs.ID = us.simulator_id
       WHERE us.simulator_id IN (${IDS_SQL})
         AND u.client_id = ${M8_CLIENT_ID}
         AND us.date_created >= '${effFrom}'
         AND us.date_created < DATE_ADD('${effTo}', INTERVAL 1 DAY)
     ) s
     ORDER BY s.Fecha_y_Hora DESC`,
    signal,
  )
  return rows
}

export async function fetchSimReport(simId: number, signal?: AbortSignal): Promise<SimReport> {
  const id = Math.trunc(simId) // ensure integer
  const [session] = await remoteSQL<{
    ID_Sim: number; ID_Caso_de_Uso: number; Usuario: string | null; Usuario_Nombre: string | null
    Fecha_y_Hora: string | null; Calificacion: number | null; Producto: string
  }>(
    `SELECT
       s.ID_Sim,
       s.ID_Caso_de_Uso,
       s.Usuario,
       s.Usuario_Nombre,
       s.Fecha_y_Hora,
       CASE WHEN s.raw_score IS NULL THEN NULL
            ELSE LEAST(100, GREATEST(0, ROUND(s.raw_score))) END AS Calificacion,
       s.Producto
     FROM (
       SELECT
         us.ID               AS ID_Sim,
         us.simulator_id     AS ID_Caso_de_Uso,
         u.email             AS Usuario,
         u.name              AS Usuario_Nombre,
         us.date_created     AS Fecha_y_Hora,
         rs.name             AS Producto,
         CASE
           WHEN us.score > 0 THEN CAST(us.score AS DECIMAL(10,2))
           WHEN us.raw_closing_data IS NOT NULL AND us.raw_closing_data != ''
             THEN COALESCE(
               CAST(JSON_UNQUOTE(JSON_EXTRACT(us.raw_closing_data, '$.score_bar'))    AS DECIMAL(10,2)),
               CAST(JSON_UNQUOTE(JSON_EXTRACT(us.raw_closing_data, '$.overall_score')) AS DECIMAL(10,2))
             )
           ELSE NULL
         END AS raw_score
       FROM r_user_session us
       JOIN r_user      u  ON u.ID  = us.user_id
       JOIN r_simulator rs ON rs.ID = us.simulator_id
       WHERE us.ID = ${id}
     ) s`,
    signal,
  )
  if (!session) throw new Error(`Session ${id} not found`)

  const details = await remoteSQL<{
    sequence: number; ai_text: string | null; user_text: string | null; retro_analysis: string | null
  }>(
    `SELECT sequence, ai_text, user_text, retro_analysis
     FROM r_user_session_details
     WHERE session_id = ${id}
     ORDER BY sequence`,
    signal,
  )

  const rondas = details.map((d) => ({
    n:               d.sequence,
    pregunta:        d.ai_text ?? null,
    respuesta_rep:   d.user_text ?? null,
    criterio:        '',
    respuesta_modelo:'',
    analisis:        d.retro_analysis ?? '',
    puntos:          null,
    max_puntos:      1,
  }))

  const producto = session.Producto.replace(/^M8\s*-\s*/i, '')
  return {
    ID_Sim:        session.ID_Sim,
    ID_Caso_de_Uso:session.ID_Caso_de_Uso,
    Usuario:       session.Usuario,
    Usuario_Nombre:session.Usuario_Nombre,
    Fecha_y_Hora:  session.Fecha_y_Hora,
    Calificacion:  session.Calificacion,
    Producto:      producto,
    Titulo:        session.Producto,
    Rondas:        rondas,
    Secciones:     [],
  }
}

// Level 2 = Representantes (field reps) → members
export async function fetchMembers(signal?: AbortSignal): Promise<MembersResponse> {
  const data = await remoteSQL<{
    mb_id: number; mb_fullname: string; mb_email: string; mb_user: string
    mb_admin: number; mb_status: number; mb_designation: string; mb_idTag1: number
  }>(
    `SELECT
       ID                              AS mb_id,
       name                            AS mb_fullname,
       email                           AS mb_email,
       email                           AS mb_user,
       0                               AS mb_admin,
       IF(disabled = 0, 1, 0)          AS mb_status,
       COALESCE(designation, '')       AS mb_designation,
       COALESCE(parent_id, 0)          AS mb_idTag1
     FROM r_user
     WHERE client_id = ${M8_CLIENT_ID}
       AND level = 2`,
    signal,
  )
  const filtered = data
    .filter((m) => !isInternalEmail(m.mb_email))
    .map((m) => ({ ...m, mb_fullname: decodeEntities(m.mb_fullname) }))
  return { ok: true, data: filtered, count: filtered.length }
}

// Level 0–1 = Directors + District Managers → admins
export async function fetchAdmins(signal?: AbortSignal): Promise<AdminsResponse> {
  const data = await remoteSQL<{
    rpa_id: number; rpa_full_name: string; rpa_email: string; rpa_parent: number
  }>(
    `SELECT
       ID                        AS rpa_id,
       name                      AS rpa_full_name,
       email                     AS rpa_email,
       COALESCE(parent_id, 0)    AS rpa_parent
     FROM r_user
     WHERE client_id = ${M8_CLIENT_ID}
       AND level IN (0, 1)`,
    signal,
  )
  const filtered = data
    .filter((a) => !isInternalEmail(a.rpa_email))
    .map((a) => ({
      ...a,
      rpa_profile_type: 'admin' as const,
      rpa_full_name: decodeEntities(a.rpa_full_name),
    }))
  return { ok: true, data: filtered, count: filtered.length }
}

// M8 has no line/tag structure
export async function fetchLines(_signal?: AbortSignal): Promise<LinesResponse> {
  return { client: 'm8', count: 0, data: [] }
}

/** Per-session turn counts — used to compute completion funnel + depth stats */
export async function fetchConversationStats(
  from?: string | null,
  to?: string | null,
  signal?: AbortSignal,
): Promise<SessionDepthRow[]> {
  const { from: effFrom, to: effTo } = resolveEffectiveDates(from ?? null, to ?? null)
  return remoteSQL<SessionDepthRow>(
    `SELECT
       us.simulator_id        AS sim_id,
       rs.name                AS sim_name,
       usd.session_id         AS session_id,
       COUNT(*)               AS turn_count
     FROM r_user_session_details usd
     JOIN r_user_session us ON us.ID = usd.session_id
     JOIN r_user u           ON u.ID  = us.user_id
     JOIN r_simulator rs     ON rs.ID = us.simulator_id
     WHERE us.simulator_id IN (${IDS_SQL})
       AND u.client_id = ${M8_CLIENT_ID}
       AND us.date_created >= '${effFrom}'
       AND us.date_created < DATE_ADD('${effTo}', INTERVAL 1 DAY)
     GROUP BY us.simulator_id, rs.name, usd.session_id`,
    signal,
  )
}

// Objection tracking not yet available for M8
export async function fetchObjections(
  _from?: string | null,
  _to?: string | null,
  _signal?: AbortSignal,
): Promise<ObjectionsResponse> {
  return { ok: true, data: [], total_records: 0 }
}
