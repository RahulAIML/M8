import type {
  ActivitiesResponse,
  AdminsResponse,
  LinesResponse,
  MembersResponse,
  ObjectionsResponse,
  Simulation,
  SimReport,
} from './types'
import { inDateWindow, resolveEffectiveDates } from '../lib/dateUtils'

const BASE        = '/m8/api'
const BRIDGE_BASE = '/m8/bridge'
// TODO: confirm the M8 platform client tag from the Rolplay org settings
const CLIENT      = 'rolplay_m8'

// M8 Pharma exercise IDs — Legalon + Abcito (Simulador + Coach) + Combined Coach
const M8_IDS = [3129, 3131, 3132, 3155, 3161]

const IDS_CSV = M8_IDS.join(',')

/** Extract YYYY-MM-DD from a date string regardless of T or space separator. */
export function simDate(fecha: string | null | undefined): string {
  return fecha?.substring(0, 10) ?? ''
}

// ─────────────────────────────────────────────
// Platform data hygiene
// ─────────────────────────────────────────────

// The platform API returns names with HTML entities ("G&oacute;mez" → "Gómez").
// A detached <textarea> decodes every named/numeric entity without executing markup.
const entityBox = typeof document !== 'undefined' ? document.createElement('textarea') : null
function decodeEntities(s: string | null | undefined): string {
  if (!s) return ''
  if (!entityBox || !s.includes('&')) return s
  entityBox.innerHTML = s
  return entityBox.value
}

// Internal platform accounts (rolplay-domain addresses) are admin tooling, not M8 participants.
function isInternalEmail(email: string | null | undefined): boolean {
  return /rolplay/i.test(email ?? '')
}

// ─────────────────────────────────────────────
// Core fetch utility
// ─────────────────────────────────────────────

async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json() as Promise<T>
}

// ─────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────

// Activity names come from the bridge (demorp6 usecases table) — the single
// source of truth for the 44 certification exercises.
export async function fetchActivities(signal?: AbortSignal): Promise<ActivitiesResponse> {
  const resp = await fetchJSON<ActivitiesResponse>(`${BRIDGE_BASE}/?action=activities.demorp6&ids=${IDS_CSV}`, signal)
  return {
    ...resp,
    data: (resp.data ?? []).map((a) => ({
      ...a,
      Caso_de_Uso: a.Caso_de_Uso.replace(/^M8\s*-\s*/i, ''),
    })),
  }
}

export async function fetchSimulations(
  from?: string | null,
  to?: string | null,
  signal?: AbortSignal,
): Promise<Simulation[]> {
  const { from: effFrom, to: effTo } = resolveEffectiveDates(from ?? null, to ?? null)
  const qs = `action=sim.demorp6&ids=${IDS_CSV}&date_from=${effFrom}&date_to=${effTo}`
  const resp = await fetchJSON<{ ok: boolean; data: Simulation[] }>(`${BRIDGE_BASE}/?${qs}`, signal)
  return (resp.data ?? []).filter((s) => {
    const date = simDate(s.Fecha_y_Hora)
    return date ? inDateWindow(date, effFrom, effTo) : false
  })
}

/** Full closing report for one session — fetched on demand from the drilldown */
export async function fetchSimReport(simId: number, signal?: AbortSignal): Promise<SimReport> {
  const resp = await fetchJSON<{ ok: boolean; data: SimReport }>(
    `${BRIDGE_BASE}/?action=sim.report&sim_id=${simId}`, signal,
  )
  const d = resp.data
  return {
    ...d,
    Producto: d.Producto?.replace(/^M8\s*-\s*/i, '') ?? d.Producto,
    Titulo:   d.Titulo?.replace(/^M8\s*-\s*/i, '')   ?? d.Titulo,
  }
}

// Members come via the bridge org proxy — trimmed to the fields the dashboard
// reads (~35 KB wire vs ~800 KB raw upstream) and disk-cached server-side.
// They are filtered to real participants (internal rolplay accounts dropped)
// and names entity-decoded HERE so every page and KPI sees identical data.
export async function fetchMembers(signal?: AbortSignal): Promise<MembersResponse> {
  const resp = await fetchJSON<MembersResponse>(`${BRIDGE_BASE}/?action=org.members`, signal)
  const data = (resp.data ?? [])
    .filter((m) => !isInternalEmail(m.mb_email) && !isInternalEmail(m.mb_user))
    .map((m) => ({
      ...m,
      mb_fullname:    decodeEntities(m.mb_fullname),
      mb_designation: decodeEntities(m.mb_designation),
    }))
  return { ...resp, data, count: data.length }
}

// 'dev' profiles are platform tooling accounts ("Administrador Dev"), not part
// of the Sanfer organization — excluded from counts, the org tree, and tables.
export async function fetchAdmins(signal?: AbortSignal): Promise<AdminsResponse> {
  const resp = await fetchJSON<AdminsResponse>(`${BRIDGE_BASE}/?action=org.admins`, signal)
  const data = (resp.data ?? [])
    .filter((a) => a.rpa_profile_type !== 'dev' && !isInternalEmail(a.rpa_email))
    .map((a) => ({ ...a, rpa_full_name: decodeEntities(a.rpa_full_name) }))
  return { ...resp, data, count: data.length }
}

export async function fetchLines(signal?: AbortSignal): Promise<LinesResponse> {
  return fetchJSON<LinesResponse>(`${BASE}/data/${CLIENT}/tag1`, signal)
}

export async function fetchObjections(
  from?: string | null,
  to?: string | null,
  signal?: AbortSignal,
): Promise<ObjectionsResponse> {
  const { from: effFrom, to: effTo } = resolveEffectiveDates(from ?? null, to ?? null)
  const qs = `action=objections.demorp6&ids=${IDS_CSV}&date_from=${effFrom}&date_to=${effTo}`
  return fetchJSON<ObjectionsResponse>(`${BRIDGE_BASE}/?${qs}`, signal)
}
