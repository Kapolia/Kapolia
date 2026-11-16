import { describe, it, expect } from 'vitest'
import {
  calculerQualites,
  qualitesPrincipales,
  troisPremieres,
  SITUATIONS,
  QUALITE_LABELS,
  type TestAnswer,
} from '@/lib/test-qualites'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function a(situation_id: number, reponse_1: 1|2|3|4, reponse_2: 1|2|3|4): TestAnswer {
  return { situation_id, reponse_1, reponse_2, version_test: 1 }
}

// Construit un jeu de réponses qui favorise certaines qualités.
// Situations V1 : on choisit les réponses qui donnent les qualités voulues.
// Situation 1 : r1=pedagogie, r2=curiosite, r3=solidarite, r4=organisation
// Situation 2 : r1=adaptabilite, r2=curiosite, r3=rigueur, r4=franchise
// Situation 3 : r1=franchise, r2=initiative, r3=rigueur, r4=ecoute
// Situation 4 : r1=organisation, r2=serenite, r3=solidarite, r4=perseverance
// Situation 5 : r1=creativite, r2=initiative, r3=adaptabilite, r4=curiosite
// Situation 6 : r1=ecoute, r2=franchise, r3=serenite, r4=solidarite
// Situation 7 : r1=perseverance, r2=rigueur, r3=creativite, r4=organisation
// Situation 8 : r1=pedagogie, r2=ecoute, r3=adaptabilite, r4=perseverance
// Situation 9 : r1=initiative, r2=serenite, r3=creativite, r4=pedagogie

// Réponses qui donnent curiosite (×3), rigueur (×3), ecoute (×2)
const ANSWERS_CURIOSITE_RIGUEUR: TestAnswer[] = [
  a(1, 2, 2), // curiosite + curiosite → curiosite×2 (mais double compte, on verra)
  a(2, 2, 3), // curiosite + rigueur
  a(3, 3, 4), // rigueur + ecoute
  a(5, 4, 1), // curiosite + creativite
  a(6, 1, 1), // ecoute + ecoute → ecoute×2
  a(7, 2, 2), // rigueur + rigueur → rigueur×2
]

// Réponses complètes : rigueur ×3, les autres ×1 ou ×2
const ANSWERS_FULL: TestAnswer[] = [
  a(1, 2, 1), // curiosite + pedagogie
  a(2, 3, 1), // rigueur + adaptabilite
  a(3, 3, 4), // rigueur + ecoute
  a(4, 2, 1), // serenite + organisation
  a(5, 3, 1), // adaptabilite + creativite
  a(6, 1, 3), // ecoute + serenite
  a(7, 2, 3), // rigueur + creativite
  a(8, 2, 3), // ecoute + adaptabilite
  a(9, 2, 4), // serenite + pedagogie
]

// ─── calculerQualites ─────────────────────────────────────────────────────────

describe('calculerQualites', () => {
  it('retourne un tableau vide si aucune réponse', () => {
    expect(calculerQualites([])).toEqual([])
  })

  it('ignore une version de test inconnue', () => {
    const r = calculerQualites([{ situation_id: 1, reponse_1: 1, reponse_2: 2, version_test: 99 }])
    expect(r).toEqual([])
  })

  it('filtre les qualités avec count < 2', () => {
    // seul pédagogie apparaît une fois (sit 1 r1)
    const r = calculerQualites([a(1, 1, 3)]) // pedagogie + solidarite — aucun ×2
    expect(r).toEqual([])
  })

  it('trie par count décroissant', () => {
    const r = calculerQualites(ANSWERS_FULL)
    expect(r[0].count).toBeGreaterThanOrEqual(r[1]?.count ?? 0)
  })

  it('rigueur ressort en premier sur ANSWERS_FULL', () => {
    const r = calculerQualites(ANSWERS_FULL)
    expect(r[0].qualite).toBe('rigueur')
  })
})

// ─── qualitesPrincipales ──────────────────────────────────────────────────────

describe('qualitesPrincipales', () => {
  it('retourne au plus 3 résultats', () => {
    const r = qualitesPrincipales(ANSWERS_FULL)
    expect(r.length).toBeLessThanOrEqual(3)
  })

  it('retourne les 3 premières du calcul complet', () => {
    const full = calculerQualites(ANSWERS_FULL)
    const top3 = qualitesPrincipales(ANSWERS_FULL)
    expect(top3).toEqual(full.slice(0, 3))
  })
})

// ─── troisPremieres ───────────────────────────────────────────────────────────

describe('troisPremieres', () => {
  const testResultats = calculerQualites(ANSWERS_FULL)

  it('retourne exactement 3 items si suffisamment de sources', () => {
    expect(troisPremieres([], testResultats).length).toBe(Math.min(3, testResultats.length))
  })

  it('les déclarées passent en premier', () => {
    const declarees = ['Franchise']
    const r = troisPremieres(declarees, testResultats)
    expect(r[0]).toBe('Franchise')
  })

  it('déduplique : déclarée déjà dans test → non répétée', () => {
    const top3Labels = testResultats.slice(0, 3).map(t => QUALITE_LABELS[t.qualite] ?? t.qualite)
    const declarees = [top3Labels[0]]
    const r = troisPremieres(declarees, testResultats)
    const count = r.filter(x => x === top3Labels[0]).length
    expect(count).toBe(1)
    expect(r.length).toBeLessThanOrEqual(3)
  })

  it('tableau vide si aucune source', () => {
    expect(troisPremieres([], [])).toEqual([])
  })

  it('retourne uniquement les déclarées si > 3 et aucun test', () => {
    const r = troisPremieres(['A', 'B', 'C', 'D'], [])
    expect(r).toEqual(['A', 'B', 'C'])
  })
})

// ─── SITUATIONS version 1 — intégrité ─────────────────────────────────────────

describe('SITUATIONS[1]', () => {
  const sits = SITUATIONS[1]
  it('9 situations', () => expect(sits).toHaveLength(9))
  it('4 réponses par situation', () => {
    for (const s of sits) expect(s.reponses).toHaveLength(4)
  })
  it('toutes les qualités sont dans QUALITE_LABELS', () => {
    for (const s of sits) {
      for (const r of s.reponses) {
        expect(QUALITE_LABELS).toHaveProperty(r.qualite)
      }
    }
  })
})
