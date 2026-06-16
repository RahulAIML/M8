// M8 Pharma — exercise registry
// Source: Rolplay platform work item (see GitHub issue)
// Products: Legalon, Abcito  |  Types: Simulador Visita Médica, Coach Certificador

export interface M8Exercise {
  saexId: number
  product: string
  type: 'Simulador' | 'Coach'
  link: string
}

export const CERT_SCORE_BAR = 80

// TODO: confirm actual certification window dates with M8
export const CERT_WINDOW = { from: '2026-06-01', to: '2026-12-31' } as const

const L = 'https://improveyourpitchbeta.net/demorp6'

export const M8_EXERCISES: M8Exercise[] = [
  { saexId: 3155, product: 'Simulador Visita Médica Legalon', type: 'Simulador', link: `${L}/index.php?uc=3155` },
  { saexId: 3161, product: 'Coach Certificador Legalon',      type: 'Coach',     link: `${L}/index.php?uc=3161` },
  { saexId: 3131, product: 'Simulador Visita Médica Abcito',  type: 'Simulador', link: `${L}/index.php?uc=3131` },
  { saexId: 3132, product: 'Coach Certificador Abcito',       type: 'Coach',     link: `${L}/index.php?uc=3132` },
  { saexId: 3129, product: 'Coach M8 Legalon y Abcito',       type: 'Coach',     link: `${L}/index.php?uc=3129` },
]
