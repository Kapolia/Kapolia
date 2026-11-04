// Source unique pour les valeurs et la présentation des statuts de candidature.
// Toute divergence label/couleur entre pages candidat et recruteur passe par ici.
import { C } from './colors'

const LIGHT_GREY  = '#D0D0D0'
const FDECEA      = '#FDECEA'

export const STATUT_VALUES = [
  'envoyée', 'vue', 'en cours', 'acceptée', 'refusée',
] as const

export type StatutCandidature = typeof STATUT_VALUES[number]

export type StatutConfig = {
  label: string
  bg:    string
  color: string
  dot:   string
}

export const STATUTS: Record<StatutCandidature, StatutConfig> = {
  'envoyée':  { label: 'Envoyée',   bg: 'rgba(100, 109, 103, 0.09)', color: C.grey,    dot: LIGHT_GREY },
  'vue':      { label: 'Vue',       bg: 'rgba(200, 138, 42, 0.10)',  color: C.attente, dot: C.attente  },
  'en cours': { label: 'En cours',  bg: 'rgba(37, 99, 235, 0.08)',   color: '#2563EB', dot: '#2563EB'  },
  'acceptée': { label: 'Acceptée',  bg: 'rgba(36, 69, 58, 0.08)',    color: C.vert,    dot: C.vert     },
  'refusée':  { label: 'Refusée',   bg: FDECEA,                      color: C.erreur,  dot: C.erreur   },
}

export function getStatut(s: string): StatutConfig {
  return STATUTS[s as StatutCandidature] ?? STATUTS['envoyée']
}
