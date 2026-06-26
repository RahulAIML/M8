// M8 Pharma — exercise registry
// Source: "Ejercicios Plataforma RolPlay App M8" official document
// Products: Legalon, Abcito  |  Types: Visita Médica, Coach

export interface M8Exercise {
  saexId: number
  product: string
  type: 'Visita Médica' | 'Coach'
  link: string
}

export const CERT_SCORE_BAR = 70
export const CERT_WINDOW = { from: '2026-06-01', to: '2026-12-31' } as const

const L = 'https://rolplay.app'

// Order matches the official exercise document
export const M8_EXERCISES: M8Exercise[] = [
  { saexId: 3161, product: 'Coach Certificador M8 Pharma Legalon', type: 'Coach',        link: `${L}/index.php?uc=3161` },
  { saexId: 3155, product: 'Simulador Visita Medica M8 Legalon',   type: 'Visita Médica', link: `${L}/index.php?uc=3155` },
  { saexId: 3132, product: 'Coach Certificador M8 Pharma Abcito',  type: 'Coach',        link: `${L}/index.php?uc=3132` },
  { saexId: 3131, product: 'Simulador Visita Medica M8 Abcito',    type: 'Visita Médica', link: `${L}/index.php?uc=3131` },
  { saexId: 3129, product: 'Coach M8 Legalon y Abcito',            type: 'Coach',        link: `${L}/index.php?uc=3129` },
]
