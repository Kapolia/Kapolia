import { describe, it, expect } from 'vitest'
import {
  lireMoisAnnee,
  ecrireMoisAnnee,
  dureeTexte,
  calculerFrise,
  preparerExperiencePourEnregistrement,
  experienceVide,
  formationVide,
  formationDebutManquant,
  formationDatesIncoherentes,
  trierExperiences,
  trierFormations,
  finAvantDebut,
  debutDansFutur,
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

// ─── trierExperiences ────────────────────────────────────────────────────────

type ExpTri = { id: string; en_poste: boolean; debut_annee: number | null; debut_mois: number | null }
function exp(id: string, en_poste: boolean, annee: number | null, mois: number | null = null): ExpTri {
  return { id, en_poste, debut_annee: annee, debut_mois: mois }
}

describe('trierExperiences', () => {
  it('en poste passe avant les terminées', () => {
    const r = trierExperiences([exp('a', false, 2022), exp('b', true, 2020)])
    expect(r[0].id).toBe('b')
  })

  it('tri par debut_annee décroissant', () => {
    const r = trierExperiences([exp('old', false, 2010), exp('new', false, 2020)])
    expect(r[0].id).toBe('new')
  })

  it('à année égale : tri par debut_mois décroissant', () => {
    const r = trierExperiences([exp('jan', false, 2020, 1), exp('dec', false, 2020, 12)])
    expect(r[0].id).toBe('dec')
  })

  it('sans date de début : placé après celles qui en ont une', () => {
    const r = trierExperiences([exp('sans', false, null), exp('avec', false, 2018)])
    expect(r[0].id).toBe('avec')
    expect(r[1].id).toBe('sans')
  })

  it('plusieurs sans date : ordre relatif conservé', () => {
    const r = trierExperiences([exp('x', false, null), exp('y', false, null)])
    expect(r[0].id).toBe('x')
    expect(r[1].id).toBe('y')
  })
})

// ─── trierFormations ──────────────────────────────────────────────────────────

type FormTri = { id: string; en_cours?: boolean; annee?: string; annee_debut?: string | null }
function form(id: string, en_cours: boolean, annee: string, annee_debut: string | null = null): FormTri {
  return { id, en_cours, annee, annee_debut }
}

describe('trierFormations', () => {
  it('en cours passe avant les terminées', () => {
    const r = trierFormations([form('a', false, '2020'), form('b', true, '2018')])
    expect(r[0].id).toBe('b')
  })

  it('tri par annee décroissant', () => {
    const r = trierFormations([form('old', false, '2010'), form('new', false, '2022')])
    expect(r[0].id).toBe('new')
  })

  it('à annee égale : tri par annee_debut décroissant', () => {
    const r = trierFormations([form('a', false, '2020', '2017'), form('b', false, '2020', '2019')])
    expect(r[0].id).toBe('b')
  })

  it('sans année : placé à la fin', () => {
    const r = trierFormations([form('sans', false, ''), form('avec', false, '2015')])
    expect(r[0].id).toBe('avec')
    expect(r[1].id).toBe('sans')
  })
})

// ─── finAvantDebut ────────────────────────────────────────────────────────────

describe('finAvantDebut', () => {
  it('faux si en_poste', () => {
    expect(finAvantDebut({ en_poste: true, debut_annee: 2020, fin_annee: 2015 })).toBe(false)
  })

  it('faux si pas de debut_annee', () => {
    expect(finAvantDebut({ en_poste: false, debut_annee: null, fin_annee: 2015 })).toBe(false)
  })

  it('faux si pas de fin_annee', () => {
    expect(finAvantDebut({ en_poste: false, debut_annee: 2020, fin_annee: null })).toBe(false)
  })

  it('vrai si fin_annee < debut_annee', () => {
    expect(finAvantDebut({ en_poste: false, debut_annee: 2014, fin_annee: 2011 })).toBe(true)
  })

  it('vrai si même année et fin_mois < debut_mois', () => {
    expect(finAvantDebut({ en_poste: false, debut_annee: 2020, debut_mois: 6, fin_annee: 2020, fin_mois: 3 })).toBe(true)
  })

  it('faux si même année et fin_mois >= debut_mois', () => {
    expect(finAvantDebut({ en_poste: false, debut_annee: 2020, debut_mois: 3, fin_annee: 2020, fin_mois: 6 })).toBe(false)
  })

  it('faux si même année sans mois (mois inconnu)', () => {
    expect(finAvantDebut({ en_poste: false, debut_annee: 2020, fin_annee: 2020 })).toBe(false)
  })
})

// ─── debutDansFutur ───────────────────────────────────────────────────────────

describe('debutDansFutur', () => {
  const maintenant = new Date(2026, 10, 17) // novembre 2026, mois = 11

  it('faux si pas de debut_annee', () => {
    expect(debutDansFutur({ debut_annee: null }, maintenant)).toBe(false)
  })

  it('faux si debut_annee dans le passé', () => {
    expect(debutDansFutur({ debut_annee: 2020 }, maintenant)).toBe(false)
  })

  it('faux si debut_annee = année courante sans mois', () => {
    expect(debutDansFutur({ debut_annee: 2026 }, maintenant)).toBe(false)
  })

  it('faux si debut_annee = année courante avec mois = mois courant', () => {
    expect(debutDansFutur({ debut_annee: 2026, debut_mois: 11 }, maintenant)).toBe(false)
  })

  it("vrai si debut_mois > mois courant dans l'année courante", () => {
    expect(debutDansFutur({ debut_annee: 2026, debut_mois: 12 }, maintenant)).toBe(true)
  })

  it('vrai si debut_annee > année courante', () => {
    expect(debutDansFutur({ debut_annee: 2027 }, maintenant)).toBe(true)
  })
})

// ─── formationDatesIncoherentes ───────────────────────────────────────────────

describe('formationDatesIncoherentes', () => {
  const maintenant = new Date(2026, 10, 17) // novembre 2026

  it('null si pas de annee_debut', () => {
    expect(formationDatesIncoherentes({ annee_debut: '', annee: '2020' }, maintenant)).toBeNull()
  })

  it('debut_apres_obtention si debut > annee', () => {
    expect(formationDatesIncoherentes({ annee_debut: '2022', annee: '2020' }, maintenant)).toBe('debut_apres_obtention')
  })

  it('null si debut < annee (cohérent)', () => {
    expect(formationDatesIncoherentes({ annee_debut: '2018', annee: '2020' }, maintenant)).toBeNull()
  })

  it('debut_futur si annee_debut > année courante', () => {
    expect(formationDatesIncoherentes({ annee_debut: '2027', annee: '' }, maintenant)).toBe('debut_futur')
  })

  it('null si formation en cours sans annee (pas de check obtention)', () => {
    expect(formationDatesIncoherentes({ annee_debut: '2024', annee: '', en_cours: true }, maintenant)).toBeNull()
  })

  it('null si formation en cours avec debut qui serait apres annee si elle existait', () => {
    expect(formationDatesIncoherentes({ annee_debut: '2025', annee: '2022', en_cours: true }, maintenant)).toBeNull()
  })
})

// ─── formationDebutManquant ───────────────────────────────────────────────────

describe('formationDebutManquant', () => {
  it('vrai si intitulé rempli sans annee_debut', () => {
    expect(formationDebutManquant({ intitule: 'BTS', ecole: '', annee_debut: '' })).toBe(true)
  })

  it('vrai si école remplie sans annee_debut', () => {
    expect(formationDebutManquant({ intitule: '', ecole: 'Université', annee_debut: '' })).toBe(true)
  })

  it('faux si intitulé et école vides', () => {
    expect(formationDebutManquant({ intitule: '', ecole: '', annee_debut: '' })).toBe(false)
  })

  it('faux si annee_debut renseignée', () => {
    expect(formationDebutManquant({ intitule: 'BTS', ecole: '', annee_debut: '2018' })).toBe(false)
  })
})

// ─── experienceVide ───────────────────────────────────────────────────────────

const EXP_VIDE = { poste: '', entreprise: '', missions: '', debut_annee: null, fin_annee: null }

describe('experienceVide', () => {
  it('vrai si tout est vide', () => {
    expect(experienceVide(EXP_VIDE)).toBe(true)
  })

  it('vrai avec des espaces dans les champs texte', () => {
    expect(experienceVide({ ...EXP_VIDE, poste: '  ', entreprise: '  ', missions: ' ' })).toBe(true)
  })

  it('faux si poste renseigné', () => {
    expect(experienceVide({ ...EXP_VIDE, poste: 'Développeur' })).toBe(false)
  })

  it('faux si entreprise renseignée', () => {
    expect(experienceVide({ ...EXP_VIDE, entreprise: 'Acme' })).toBe(false)
  })

  it('faux si missions renseignées', () => {
    expect(experienceVide({ ...EXP_VIDE, missions: 'Gestion des stocks' })).toBe(false)
  })

  it('faux si debut_annee renseignée', () => {
    expect(experienceVide({ ...EXP_VIDE, debut_annee: 2020 })).toBe(false)
  })

  it('faux si fin_annee renseignée', () => {
    expect(experienceVide({ ...EXP_VIDE, fin_annee: 2023 })).toBe(false)
  })
})

// ─── formationVide ────────────────────────────────────────────────────────────

const FORM_VIDE = { intitule: '', ecole: '', annee: '' }

describe('formationVide', () => {
  it('vrai si tout est vide', () => {
    expect(formationVide(FORM_VIDE)).toBe(true)
  })

  it('vrai avec des espaces', () => {
    expect(formationVide({ intitule: '  ', ecole: '  ', annee: '' })).toBe(true)
  })

  it('faux si intitulé renseigné', () => {
    expect(formationVide({ ...FORM_VIDE, intitule: 'BTS Commerce' })).toBe(false)
  })

  it('faux si école renseignée', () => {
    expect(formationVide({ ...FORM_VIDE, ecole: 'Lycée Victor Hugo' })).toBe(false)
  })

  it('faux si année renseignée', () => {
    expect(formationVide({ ...FORM_VIDE, annee: '2021' })).toBe(false)
  })
})
