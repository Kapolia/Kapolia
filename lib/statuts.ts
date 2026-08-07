// Source unique pour les valeurs et la présentation des statuts de candidature.
// Toute divergence label/couleur entre pages candidat et recruteur passe par ici.

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
  'envoyée':  { label: 'Envoyée',   bg: 'rgba(107,107,107,0.09)', color: '#6B6B6B', dot: '#D0D0D0' },
  'vue':      { label: 'Vue',       bg: 'rgba(200,138,42,0.10)',  color: '#C88A2A', dot: '#C88A2A' },
  'en cours': { label: 'En cours',  bg: 'rgba(37,99,235,0.08)',   color: '#2563EB', dot: '#2563EB' },
  'acceptée': { label: 'Acceptée',  bg: 'rgba(44,74,62,0.08)',    color: '#2C4A3E', dot: '#2C4A3E' },
  'refusée':  { label: 'Refusée',   bg: '#FDECEA',               color: '#C0392B', dot: '#C0392B' },
}

export function getStatut(s: string): StatutConfig {
  return STATUTS[s as StatutCandidature] ?? STATUTS['envoyée']
}
