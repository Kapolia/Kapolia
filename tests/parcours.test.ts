import { describe, it, expect } from 'vitest'
import {
  lireMoisAnnee,
  ecrireMoisAnnee,
  dureeTexte,
  calculerFrise,
  preparerExperiencePourEnregistrement,
  type PosteParcours,
  type FormationParcours,
} from '@/lib/parcours'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function p(
  id: string,
  dA: number, dM: number | null,
  fA: number | null, fM: number | null,
  enPoste = false,
): PosteParcours {
  return {
    id, poste: 'p', entreprise: 'e',
    debut: { annee: dA, mois: dM },
    fin:   fA === null ? null : { annee: fA, mois: fM },
    enPoste,
  }
}

function f(
  id: string,
  dA: number | null, dM: number | null,
  fA: number, fM: number | null,
  enCours = false,
): FormationParcours {
  return {
    id, intitule: 'f',
    debut: dA === null ? null : { annee: dA, mois: dM },
    fin:   { annee: fA, mois: fM },
    enCours,
  }
}

const NOW = new Date(2026, 10, 15) // 15 novembre 2026

// ─── lireMoisAnnee ───────────────────────────────────────────────────────────

describe('lireMoisAnnee', () => {
  it('Septembre 2020 → 2020 mois 9', () => {
    expect(lireMoisAnnee('Septembre 2020')).toEqual({ annee: 2020, mois: 9 })
  })
  it('août 2023 → 2023 mois 8', () => {
    expect(lireMoisAnnee('août 2023')).toEqual({ annee: 2023, mois: 8 })
  })
  it('Decembre 2021 → 2021 mois 12 (sans accent)', () => {
    expect(lireMoisAnnee('Decembre 2021')).toEqual({ annee: 2021, mois: 12 })
  })
  it('2019 → annee 2019, mois null', () => {
    expect(lireMoisAnnee('2019')).toEqual({ annee: 2019, mois: null })
  })
  it('"d" → null', () => {
    expect(lireMoisAnnee('d')).toBeNull()
  })
  it('chaîne vide → null', () => {
    expect(lireMoisAnnee('')).toBeNull()
  })
})

// ─── ecrireMoisAnnee ─────────────────────────────────────────────────────────

describe('ecrireMoisAnnee', () => {
  it('{ annee: 2020, mois: 9 } → "Septembre 2020"', () => {
    expect(ecrireMoisAnnee({ annee: 2020, mois: 9 })).toBe('Septembre 2020')
  })
})

// ─── dureeTexte ──────────────────────────────────────────────────────────────

describe('dureeTexte', () => {
  it('sep 2022 → sep 2023 : 1 an', () => {
    expect(dureeTexte({ annee: 2022, mois: 9 }, { annee: 2023, mois: 9 }, false)).toBe('1 an')
  })
  it('mars 2021 → nov 2026 : 5 ans 8 mois', () => {
    expect(dureeTexte({ annee: 2021, mois: 3 }, { annee: 2026, mois: 11 }, false)).toBe('5 ans 8 mois')
  })
  it('mai 2018 → déc 2018 : 7 mois', () => {
    expect(dureeTexte({ annee: 2018, mois: 5 }, { annee: 2018, mois: 12 }, false)).toBe('7 mois')
  })
})

// ─── calculerFrise — cas 1 : non resserré ─────────────────────────────────────
// Postes 2014-2017, sep 2017-mars 2021, mars 2021-aujourd'hui ; formation 2015-2017
// Carrière ~12 ans → pas de resserre

describe('calculerFrise cas 1 — non resserré', () => {
  const postes = [
    p('a', 2014, null, 2017, null),
    p('b', 2017, 9,   2021, 3),
    p('c', 2021, 3,   null, null, true),
  ]
  const formations = [f('f1', 2015, null, 2017, null)]
  const r = calculerFrise(postes, formations, NOW)

  it('visible', ()        => expect(r.visible).toBe(true))
  it('non resserré', ()   => expect(r.resserre).toBe(false))
  it('seuil null', ()     => expect(r.seuil).toBeNull())
  it('0 anciens', ()      => expect(r.nbAnciens).toBe(0))
  it('3 segments', ()     => expect(r.segments).toHaveLength(3))
  it('1 formation', ()    => expect(r.formations).toHaveLength(1))
})

// ─── calculerFrise — cas 2 : resserré, seuil 2011, 5 anciens ─────────────────
// 9 postes de 1996 à aujourd'hui ; 2010-2011 (fin_annee=2011 ≤ seuil) compte dans anciens

describe('calculerFrise cas 2 — resserré seuil 2011, 5 anciens', () => {
  const postes = [
    p('a', 1996, null, 1999, null),
    p('b', 1999, null, 2001, null),
    p('c', 2001, null, 2004, null),
    p('d', 2004, null, 2008, 5),   // 2008.3 ≈ mai
    p('e', 2010, null, 2011, null), // fin_annee 2011 = seuil → ancien
    p('f', 2011, null, 2014, null),
    p('g', 2014, null, 2017, null),
    p('h', 2017, 9,   2021, 3),
    p('i', 2021, 3,   null, null, true),
  ]
  const formations = [
    f('f1', 1996, null, 1998, null),
    f('f2', 2015, null, 2017, null),
  ]
  const r = calculerFrise(postes, formations, NOW)

  it('resserré', ()       => expect(r.resserre).toBe(true))
  it('seuil = 2011', ()   => expect(r.seuil).toBe(2011))
  it('5 anciens', ()      => expect(r.nbAnciens).toBe(5))
  it('formation ancienne invisible', () => expect(r.formations).toHaveLength(1))
})

// ─── calculerFrise — cas 3 : seuil reculé à 2008 ────────────────────────────
// 2008-2014 croise le seuil initial 2011 ; 2027-2008=19 ≤ 20 → seuil = 2008

describe('calculerFrise cas 3 — seuil reculé à 2008', () => {
  const postes = [
    p('a', 1994, null, 2000, null),
    p('b', 2000, null, 2008, null),
    p('c', 2008, null, 2014, null),
    p('d', 2014, null, 2020, null),
    p('e', 2020, null, null, null, true),
  ]
  const r = calculerFrise(postes, [], NOW)

  it('resserré', ()       => expect(r.resserre).toBe(true))
  it('seuil = 2008', ()   => expect(r.seuil).toBe(2008))
})

// ─── calculerFrise — cas 5 : seuil 2011, depuis 1998, 1 ancien ───────────────
// 1998-2019 croise le seuil ; candidat 1998 : 2027-1998=29 > 20 → ne bouge pas
// → depuis = 1998, 1 poste ancien (1991-1998)

describe('calculerFrise cas 5 — depuis = 1998, 1 ancien', () => {
  const postes = [
    p('a', 1991, null, 1998, null),
    p('b', 1998, null, 2019, null),
    p('c', 2019, null, null, null, true),
  ]
  const r = calculerFrise(postes, [], NOW)
  const segB = r.segments.find(s => s.id === 'b')

  it('seuil = 2011', ()          => expect(r.seuil).toBe(2011))
  it('depuis = 1998 sur poste b', () => expect(segB?.depuis).toBe(1998))
  it('1 ancien', ()              => expect(r.nbAnciens).toBe(1))
  it('gauche = 12 sur poste b',  () => expect(segB?.gauche).toBe(12))
})

// ─── calculerFrise — cas 6 : 2 lignes ────────────────────────────────────────
// P1 et P3 se partagent la ligne 0 (P3 commence exactement quand P1 finit)

describe('calculerFrise cas 6 — 2 lignes', () => {
  const postes = [
    p('a', 2017, null, 2021, 7),    // fin juil. 2021
    p('b', 2019, null, 2023, null),
    p('c', 2021, 7,   null, null, true), // début juil. 2021 = fin de P1
  ]
  const r = calculerFrise(postes, [], NOW)

  it('visible', ()          => expect(r.visible).toBe(true))
  it('2 lignes utilisées',  () => {
    expect(new Set(r.segments.map(s => s.ligne)).size).toBe(2)
  })
})

// ─── calculerFrise — cas 7 : formations année scolaire, même ligne ────────────
// Licence 2019→2022 et Master 2022→2024 (début sept = +8/12, fin juin = +5/12).
// Licence finit juin 2022 (2022.417), Master commence sept 2022 (2022.667) → pas de chevauchement.

describe('calculerFrise cas 7 — formations année scolaire, même ligne', () => {
  const postes = [
    p('a', 2017, null, 2020, null),
    p('b', 2020, null, null, null, true),
  ]
  const formations = [
    f('l', 2019, null, 2022, null),
    f('m', 2022, null, 2024, null),
  ]
  const r = calculerFrise(postes, formations, NOW)

  it('2 segments de formation visibles', () => expect(r.formations).toHaveLength(2))
  it('formations sur une seule ligne', () => {
    expect(new Set(r.formations.map(s => s.ligne)).size).toBe(1)
  })
})

// ─── calculerFrise — cas 10 : un seul poste ──────────────────────────────────

describe('calculerFrise cas 10 — un seul poste', () => {
  const r = calculerFrise([p('a', 2020, null, null, null, true)], [], NOW)
  it('visible = false', () => expect(r.visible).toBe(false))
})

// ─── preparerExperiencePourEnregistrement ─────────────────────────────────────

describe('preparerExperiencePourEnregistrement', () => {
  const BASE = { poste: 'Dev', entreprise: 'Acme', missions: '' }

  it('en poste : date_fin vide, date_debut calculée', () => {
    const r = preparerExperiencePourEnregistrement({ ...BASE, en_poste: true, debut_annee: 2021, debut_mois: 3, fin_annee: 2023, fin_mois: 6 })
    expect(r.date_debut).toBe('Mars 2021')
    expect(r.date_fin).toBe('')
    expect(r.date_a_verifier).toBe(false)
  })

  it('fin saisie : les deux dates calculées', () => {
    const r = preparerExperiencePourEnregistrement({ ...BASE, en_poste: false, debut_annee: 2019, debut_mois: null, fin_annee: 2022, fin_mois: 11 })
    expect(r.date_debut).toBe('2019')
    expect(r.date_fin).toBe('Novembre 2022')
  })

  it('année seule sans mois : format "2020"', () => {
    const r = preparerExperiencePourEnregistrement({ ...BASE, en_poste: false, debut_annee: 2020, debut_mois: null, fin_annee: null, fin_mois: null })
    expect(r.date_debut).toBe('2020')
    expect(r.date_fin).toBe('')
  })

  it('ancienne valeur texte conservée si aucune année saisie', () => {
    const r = preparerExperiencePourEnregistrement({ ...BASE, en_poste: false, debut_annee: null, debut_mois: null, fin_annee: null, fin_mois: null, date_debut: 'Jan 2018', date_fin: 'Déc 2019' })
    expect(r.date_debut).toBe('Jan 2018')
    expect(r.date_fin).toBe('Déc 2019')
  })

  it('clé inconnue conservée dans le résultat', () => {
    const r = preparerExperiencePourEnregistrement({ ...BASE, en_poste: false, debut_annee: 2021, debut_mois: 1, fin_annee: null, fin_mois: null, foo: 'bar' } as never)
    expect((r as Record<string, unknown>).foo).toBe('bar')
  })
})
