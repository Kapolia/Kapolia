import { haversineKm } from './geo'
import type { OffreSimilaire } from '@/components/OffreDetail'

export type SimOffre = {
  id: string
  titre: string
  domaine?: string | null
  experience?: string | null
  type_contrat?: string | null
  salaire_min?: number | null
  salaire_max?: number | null
  periode_salaire?: string | null
  mode_travail?: string | null
  ville?: string | null
  created_at: string
  latitude?: number | null
  longitude?: number | null
  entreprise_nom?: string | null
}

const SIM_EXP_ORDER = ['Sans expérience', '1-2 ans', '3-5 ans', '5-10 ans', '+10 ans']

function simSalMid(min?: number | null, max?: number | null) {
  if (min && max) return (min + max) / 2
  return min ?? max ?? 0
}

function scoreForSim(ref: SimOffre, cand: SimOffre): number {
  let s = 0
  if (ref.experience && cand.experience) {
    const ri = SIM_EXP_ORDER.indexOf(ref.experience)
    const ci = SIM_EXP_ORDER.indexOf(cand.experience)
    if (ri !== -1 && ci !== -1) {
      const d = Math.abs(ri - ci)
      if (d === 0) s += 2
      else if (d === 1) s += 1
    }
  }
  if (ref.type_contrat && cand.type_contrat === ref.type_contrat) s += 2
  const refMid = simSalMid(ref.salaire_min, ref.salaire_max)
  const candMid = simSalMid(cand.salaire_min, cand.salaire_max)
  if (refMid > 0 && candMid > 0 && Math.abs(refMid - candMid) / refMid <= 0.3) s += 1
  return s
}

function offreToSimilaire(o: SimOffre): OffreSimilaire {
  return {
    id: o.id,
    titre: o.titre,
    entreprise_nom: o.entreprise_nom ?? undefined,
    type_contrat:   o.type_contrat   ?? undefined,
    domaine:        o.domaine        ?? undefined,
    ville:          o.ville          ?? undefined,
    salaire_min:    o.salaire_min    ?? undefined,
    salaire_max:    o.salaire_max    ?? undefined,
    periode_salaire: o.periode_salaire ?? undefined,
    mode_travail:   o.mode_travail   ?? undefined,
  }
}

export function trouverSimilaires(
  ref:        SimOffre,
  candidates: SimOffre[],
): { similaires: OffreSimilaire[]; titre: string } {
  // Phase 1 : même domaine
  const domainPool = ref.domaine ? candidates.filter(o => o.domaine === ref.domaine) : []
  if (domainPool.length >= 2) {
    const scored = domainPool
      .map(o => ({ o, score: scoreForSim(ref, o) }))
      .sort((a, b) => b.score - a.score || new Date(b.o.created_at).getTime() - new Date(a.o.created_at).getTime())
    const withExtra = scored.filter(({ score }) => score >= 1)
    if (withExtra.length >= 2) {
      return { similaires: withExtra.slice(0, 4).map(({ o }) => offreToSimilaire(o)), titre: 'Offres similaires' }
    }
    return {
      similaires: scored.slice(0, 4).map(({ o }) => offreToSimilaire(o)),
      titre: ref.domaine ? `Autres offres en ${ref.domaine}` : 'Autres offres',
    }
  }

  // Phase 2 : fallback géographique
  if (ref.latitude != null && ref.longitude != null) {
    const nearby = candidates.filter(o =>
      o.latitude != null && o.longitude != null &&
      haversineKm({ lat: ref.latitude!, lng: ref.longitude! }, { lat: o.latitude!, lng: o.longitude! }) < 50
    )
    if (nearby.length >= 2) {
      return {
        similaires: nearby.slice(0, 4).map(offreToSimilaire),
        titre: ref.ville ? `Autres offres près de ${ref.ville}` : 'Autres offres à proximité',
      }
    }
  }

  return { similaires: [], titre: '' }
}
