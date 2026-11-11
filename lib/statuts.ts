// Source unique pour les valeurs et la présentation des statuts de candidature.
// Toute divergence label/couleur entre pages candidat et recruteur passe par ici.
import { C } from './colors'

const LIGHT_GREY  = '#D0D0D0'
const FDECEA      = '#FDECEA'

export const STATUT_VALUES = [
  'envoyée', 'vue', 'en cours', 'acceptée', 'refusée',
] as const

export type StatutCandidature = typeof STATUT_VALUES[number]

export type StatutCandidatConfig = {
  bg:    string
  color: string
  dot:   string
  dotStyle?: 'ring'
}

export type StatutConfig = {
  label:         string
  labelCandidat: string
  bg:            string
  color:         string
  dot:           string
  candidat:      StatutCandidatConfig
}

export const STATUTS: Record<StatutCandidature, StatutConfig> = {
  'envoyée': {
    label: 'Envoyée', labelCandidat: 'Envoyée',
    bg: 'rgba(100, 109, 103, 0.09)', color: C.grey, dot: LIGHT_GREY,
    candidat: { bg: '#F1F3F2', color: C.grey, dot: '#B9BFBB' },
  },
  'vue': {
    label: 'Vue', labelCandidat: 'Vue',
    bg: 'rgba(200, 138, 42, 0.10)', color: C.attente, dot: C.attente,
    candidat: { bg: 'rgba(200,138,42,.13)', color: '#8A5D14', dot: C.attente },
  },
  'en cours': {
    label: 'En cours', labelCandidat: 'En cours',
    bg: 'rgba(37, 99, 235, 0.08)', color: '#2563EB', dot: '#2563EB',
    candidat: { bg: C.salaire, color: C.vert, dot: C.vert },
  },
  'acceptée': {
    label: 'Acceptée', labelCandidat: 'Retenue',
    bg: 'rgba(36, 69, 58, 0.08)', color: C.vert, dot: C.vert,
    candidat: { bg: 'rgba(62,142,94,.14)', color: '#2F7049', dot: C.succes },
  },
  'refusée': {
    label: 'Refusée', labelCandidat: 'Non retenue',
    bg: FDECEA, color: C.erreur, dot: C.erreur,
    candidat: { bg: '#F1F3F2', color: C.grey, dot: '#9AA19C', dotStyle: 'ring' },
  },
}

export function getStatut(s: string): StatutConfig {
  return STATUTS[s as StatutCandidature] ?? STATUTS['envoyée']
}
