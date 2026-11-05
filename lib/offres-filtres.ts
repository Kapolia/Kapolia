import { TEMPS_TRAVAIL, DATE_MIGRATION_CRITERES } from '@/lib/referentiels'

export const TEMPS_TRAVAIL_VALS = new Set(TEMPS_TRAVAIL.map(t => t.value))

export type OffreChamps = {
  temps_travail?: string | null
  horaires?: string[]
  permis?: string[]
  published_at?: string | null
  statut_cadre?: boolean
  logement_fourni?: boolean
  repas_fournis?: boolean
  ouvert_handicap?: boolean
}

export function matchHoraires(o: OffreChamps, selectedHoraires: string[]): boolean {
  if (selectedHoraires.length === 0) return true
  const selectedTT = selectedHoraires.filter(v => TEMPS_TRAVAIL_VALS.has(v))
  const selectedH  = selectedHoraires.filter(v => !TEMPS_TRAVAIL_VALS.has(v))
  if (selectedTT.length > 0 && !selectedTT.includes(o.temps_travail ?? '')) return false
  if (selectedH.length  > 0 && !selectedH.some(h => (o.horaires ?? []).includes(h))) return false
  return true
}

export function matchPermis(o: OffreChamps, selectedPermis: string[]): boolean {
  if (selectedPermis.length === 0) return true
  return selectedPermis.some(p => {
    if (p === 'sans_permis') {
      return (o.permis ?? []).length === 0
        && !!o.published_at
        && new Date(o.published_at).getTime() > DATE_MIGRATION_CRITERES
    }
    return (o.permis ?? []).includes(p)
  })
}

export function matchAutres(o: OffreChamps, selectedAutres: string[]): boolean {
  if (selectedAutres.length === 0) return true
  return selectedAutres.every(a => {
    if (a === 'statut_cadre')    return !!o.statut_cadre
    if (a === 'logement_fourni') return !!o.logement_fourni
    if (a === 'repas_fournis')   return !!o.repas_fournis
    if (a === 'ouvert_handicap') return !!o.ouvert_handicap
    return true
  })
}
