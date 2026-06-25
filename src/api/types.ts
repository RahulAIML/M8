// ─────────────────────────────────────────────
// DIM_ACTIVIDADES
// ─────────────────────────────────────────────
export interface Activity {
  Actividad_Nombre: string
  Caso_de_Uso: string
  ID_Caso_de_Uso: number
  Criterio1?: string
  Criterio2?: string
  Criterio3?: string
  Criterio4?: string
  Criterio5?: string
}

export interface ActivitiesResponse {
  ok: boolean
  data: Activity[]
  total_records: number
}

// ─────────────────────────────────────────────
// FACT_ROLPLAY_SIM
// ─────────────────────────────────────────────
export interface Simulation {
  Calificacion: number
  Diagnostico_Final: string | null  // lowercase 'si' / 'no' from API
  Fecha_y_Hora: string
  ID_Caso_de_Uso: number
  ID_Sim: number
  Pregunta_1: string | null
  Pregunta_2: string | null
  Pregunta_3: string | null
  Pregunta_4: string | null
  Pregunta_5: string | null
  Pregunta_6: string | null     // round 6 = closing exchange, never scored
  Puntos_1: number | string | null   // rounds 1–5 scored 0 or 1 (validated vs demorp6)
  Puntos_2: number | string | null
  Puntos_3: number | string | null
  Puntos_4: number | string | null
  Puntos_5: number | string | null
  Puntos_6: number | string | null   // always "No aplica" in practice
  Puntos_Totales: number             // scoreData.sum — 0..5
  Respuesta_1: string | null
  Respuesta_2: string | null
  Respuesta_3: string | null
  Respuesta_4: string | null
  Respuesta_5: string | null
  Respuesta_6: string | null
  Retroalimentacion_1: string | null
  Retroalimentacion_2: string | null
  Retroalimentacion_3: string | null
  Retroalimentacion_4: string | null
  Retroalimentacion_5: string | null
  Retroalimentacion_6: string | null
  Usuario: string | null
  Usuario_Nombre: string | null
}

export type SimulationsResponse = Simulation[] | { data: Simulation[]; total_records?: number }

// ─────────────────────────────────────────────
// Per-session closing report (bridge action=sim.report)
// ─────────────────────────────────────────────
export interface SimReportSection {
  q: string
  a: string   // multi-line answers use \n separators
}

export interface SimRonda {
  n: number
  pregunta: string | null
  respuesta_rep: string | null
  criterio: string
  respuesta_modelo: string
  analisis: string
  puntos: number | null   // 0 or 1; null = unscored (round 6 or missing)
  max_puntos: number
}

export interface SimReport {
  ID_Sim: number
  ID_Caso_de_Uso: number
  Usuario: string | null
  Usuario_Nombre: string | null
  Fecha_y_Hora: string | null
  Calificacion: number
  Producto: string          // simulator/product name from usecases table
  Titulo: string
  Rondas: SimRonda[]        // parsed interaction rounds 1–5
  Secciones: SimReportSection[]
}

// ─────────────────────────────────────────────
// DIM_USERDIST (members)
// ─────────────────────────────────────────────
// Served by the bridge org.members proxy — only the fields the dashboard
// reads (the raw platform endpoint ships ~25 fields incl. user tokens).
export interface Member {
  mb_id: number
  mb_fullname: string
  mb_email: string
  mb_user: string
  mb_admin: number
  mb_status: number          // 1 = active, 0 = inactive
  mb_designation: string
  mb_idTag1: number          // 0 = no line assigned; maps to LineTag.id
}

export interface MembersResponse {
  ok?: boolean
  count: number
  data: Member[]
}

// ─────────────────────────────────────────────
// DIM_ADMIN (administrators)
// ─────────────────────────────────────────────
export type ProfileType = 'dev' | 'tenant' | 'supervisor' | 'admin' | 'enradmin'

// Served by the bridge org.admins proxy — trimmed to the fields in use.
export interface Administrator {
  rpa_id: number
  rpa_full_name: string
  rpa_email: string
  rpa_profile_type: ProfileType
  rpa_parent: number
}

export interface AdminsResponse {
  ok?: boolean
  count: number
  data: Administrator[]
}

// ─────────────────────────────────────────────
// DIM_LINE (tag1) — M8 pharma-specific
// ─────────────────────────────────────────────
export interface LineTag {
  id: number
  name: string
  description: string
  idStatus: number   // 1 = active
}

export interface LinesResponse {
  client: string
  count: number
  data: LineTag[]
  database?: string
  table?: string
}

// ─────────────────────────────────────────────
// Objection handling stats
// ─────────────────────────────────────────────
export interface ObjectionStat {
  usecase_id: number
  objection_text: string
  count: number       // sessions where this objection appeared
  pass_count: number  // sessions where rep scored 1 on it
  pass_rate: number   // pass_count / scored × 100 (rounded int)
}

export interface ObjectionsResponse {
  ok: boolean
  data: ObjectionStat[]
  total_records: number
}
