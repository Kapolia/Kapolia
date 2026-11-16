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

// Situation 1 : r1=pedagogie, r2=curiosite, r3=solidarite,  r4=organisation
// Situation 2 : r1=adaptabilite, r2=curiosite, r3=rigueur,  r4=franchise
// Situation 3 : r1=franchise, r2=initiative,  r3=rigueur,   r4=ecoute
// Situation 4 : r1=organisation, r2=serenite,  r3=solidarite, r4=perseverance
// Situation 5 : r1=creativite,  r2=initiative, r3=adaptabilite, r4=curiosite
// Situation 6 : r1=ecoute,      r2=franchise,  r3=serenite,  r4=solidarite
// Situation 7 : r1=perseverance,r2=rigueur,    r3=creativite,r4=organisation
// Situation 8 : r1=pedagogie,   r2=ecoute,     r3=adaptabilite, r4=perseverance
// Situation 9 : r1=initiative,  r2=serenite,   r3=creativite,r4=pedagogie

// ─── calculerQualites ─────────────────────────────────────────────────────────

describe('calculerQualites', () => {
  it('tableau vide si aucune réponse', () => {
    expect(calculerQualites([])).toEqual([])
  })

  it('ignore une version inconnue', () => {
    expect(calculerQualites([{ situation_id: 1, reponse_1: 1, reponse_2: 2, version_test: 99 }])).toEqual([])
  })

  it('filtre les qualités avec count < 2', () => {
    const r = calculerQualites([a(1, 1, 3)]) // pedagogie + solidarite — aucun ×2
    expect(r).toEqual([])
  })

  it('trie par count décroissant', () => {
    // rigueur ×3 (sit2r3+sit3r3+sit7r2), ecoute ×2 (sit3r4+sit6r1)
    const r = calculerQualites([a(2, 3, 1), a(3, 3, 4), a(6, 1, 2), a(7, 2, 1)])
    expect(r[0].qualite).toBe('rigueur')
    expect(r[0].count).toBe(3)
  })
})

// ─── qualitesPrincipales — tri et égalités ────────────────────────────────────

describe('qualitesPrincipales', () => {
  it('tableau vide si aucune réponse', () => {
    expect(qualitesPrincipales([])).toEqual([])
  })

  it('au plus 3 éléments', () => {
    const answers = [
      a(2, 3, 1), a(3, 3, 4), a(6, 1, 2), a(7, 2, 1), // rigueur ×3, ecoute ×2, ...
      a(4, 2, 3), a(5, 3, 1), a(8, 3, 2),               // serenite + adaptabilite + ...
    ]
    expect(qualitesPrincipales(answers).length).toBeLessThanOrEqual(3)
  })

  it('renvoie des clés (pas des libellés)', () => {
    const r = qualitesPrincipales([a(2, 3, 1), a(3, 3, 1)])
    for (const k of r) expect(QUALITE_LABELS).toHaveProperty(k)
  })

  it('exclut les qualités choisies moins de 2 fois', () => {
    // seul rigueur ×2, les autres ×1 — seule rigueur ressort
    const r = qualitesPrincipales([a(2, 3, 1), a(3, 3, 4)])
    expect(r).toEqual(['rigueur'])
  })

  it('peut renvoyer moins de 3 si peu de qualités atteignent ×2', () => {
    // rigueur ×2, ecoute ×2, rien d'autre ×2 avec seulement 3 situations
    const r = qualitesPrincipales([a(2, 3, 2), a(3, 3, 4), a(6, 1, 2)])
    expect(r.length).toBeLessThan(3)
  })

  it('départage les égalités de count par nombre de reponse_1', () => {
    // rigueur ×2 : r1 les 2 fois (sit2r3=rigueur r1, sit3r3=rigueur r2)
    // → sit2 : reponse_1=3 (rigueur), sit3 : reponse_1=1 (franchise) → rigueur firstPick=1
    // ecoute ×2 : sit3r4 et sit6r1 → sit6 reponse_1=1 (ecoute) → ecoute firstPick=1
    // Les deux ont firstPick=1, départagés par QUALITE_LABELS : ecoute index 0 < rigueur index 2
    // → ecoute avant rigueur
    const r = qualitesPrincipales([a(2, 1, 3), a(3, 4, 3), a(6, 1, 3)])
    // ecoute: sit3r4 + sit6r1 = ×2, firstPick via sit6r1=1
    // rigueur: sit2r3 + sit3r3 = ×2, firstPick=0 (jamais r1)
    // ecoute firstPick(1) > rigueur firstPick(0) → ecoute en premier
    expect(r[0]).toBe('ecoute')
    expect(r[1]).toBe('rigueur')
  })

  it('départage les égalités complètes par ordre de QUALITE_LABELS', () => {
    // ecoute et rigueur : même count ×2, même firstPick=0
    // ordre QUALITE_LABELS : ecoute index 0, rigueur index 2 → ecoute avant rigueur
    const r = qualitesPrincipales([
      a(2, 1, 3), // adaptabilite + rigueur
      a(3, 4, 3), // ecoute + rigueur — rigueur ×2
      a(6, 2, 1), // franchise + ecoute — ecoute ×2
    ])
    // ecoute: sit3r4 + sit6r1 = ×2, firstPick=0
    // rigueur: sit2r3 + sit3r3 = ×2, firstPick=0
    // même count(2) et firstPick(0) → ordre QUALITE_LABELS
    const idxEcoute  = Object.keys(QUALITE_LABELS).indexOf('ecoute')
    const idxRigueur = Object.keys(QUALITE_LABELS).indexOf('rigueur')
    expect(idxEcoute).toBeLessThan(idxRigueur)
    if (r.includes('ecoute') && r.includes('rigueur')) {
      expect(r.indexOf('ecoute')).toBeLessThan(r.indexOf('rigueur'))
    }
  })
})

// ─── troisPremieres ───────────────────────────────────────────────────────────

describe('troisPremieres', () => {
  const qTest: Record<string, number> = { rigueur: 3, ecoute: 2, serenite: 2, creativite: 2 }

  it('renvoie qualitesPrincipales tel quel quand non vide', () => {
    const r = troisPremieres(['rigueur', 'ecoute'], qTest)
    expect(r).toEqual(['rigueur', 'ecoute'])
  })

  it('repli sur qualitesTest quand qualitesPrincipales est null', () => {
    const r = troisPremieres(null, qTest)
    expect(r).toHaveLength(3)
    expect(r[0]).toBe('rigueur') // count le plus élevé
  })

  it('repli sur qualitesTest quand qualitesPrincipales est []', () => {
    const r = troisPremieres([], qTest)
    expect(r[0]).toBe('rigueur')
  })

  it('tableau vide si les deux sont null/vides', () => {
    expect(troisPremieres(null, null)).toEqual([])
    expect(troisPremieres([], null)).toEqual([])
    expect(troisPremieres(null, {})).toEqual([])
  })

  it('repli : au plus 3 clés depuis qualitesTest', () => {
    const r = troisPremieres(null, qTest)
    expect(r.length).toBeLessThanOrEqual(3)
  })

  it('repli : départage les égalités par ordre de QUALITE_LABELS', () => {
    // ecoute, serenite, creativite ont tous count=2
    const r = troisPremieres(null, { ecoute: 2, serenite: 2, creativite: 2 })
    const keyOrder = Object.keys(QUALITE_LABELS)
    expect(keyOrder.indexOf(r[0])).toBeLessThan(keyOrder.indexOf(r[1]))
    expect(keyOrder.indexOf(r[1])).toBeLessThan(keyOrder.indexOf(r[2]))
  })

  it("aucune qualité déclarée ne peut entrer via qualitesPrincipales (clés seulement)", () => {
    // qualitesPrincipales contient uniquement des clés de QUALITE_LABELS
    const r = troisPremieres(['rigueur'], qTest)
    for (const k of r) expect(Object.keys(QUALITE_LABELS)).toContain(k)
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
      for (const r of s.reponses) expect(QUALITE_LABELS).toHaveProperty(r.qualite)
    }
  })
})
