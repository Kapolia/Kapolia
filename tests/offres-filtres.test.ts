import { describe, it, expect } from 'vitest'
import { matchHoraires, matchPermis, matchAutres, type OffreChamps } from '@/lib/offres-filtres'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function offre(overrides: Partial<OffreChamps> = {}): OffreChamps {
  return {
    temps_travail: null,
    horaires: [],
    permis: [],
    published_at: null,
    statut_cadre: false,
    logement_fourni: false,
    repas_fournis: false,
    ouvert_handicap: false,
    ...overrides,
  }
}

const APRES_MIGRATION = '2026-11-06T00:00:00Z'
const AVANT_MIGRATION = '2026-11-04T00:00:00Z'

// ─── Règle 1 — Horaires de travail ────────────────────────────────────────────
// temps_travail (ou) | horaires[] (ou) ; entre les deux sous-groupes : et

describe('matchHoraires', () => {

  it('aucun filtre sélectionné → tout passe', () => {
    expect(matchHoraires(offre({ temps_travail: 'temps_plein' }), [])).toBe(true)
    expect(matchHoraires(offre(), [])).toBe(true)
  })

  it('temps_plein seul → garde les offres à temps plein', () => {
    expect(matchHoraires(offre({ temps_travail: 'temps_plein' }),  ['temps_plein'])).toBe(true)
    expect(matchHoraires(offre({ temps_travail: 'temps_partiel' }), ['temps_plein'])).toBe(false)
    expect(matchHoraires(offre({ temps_travail: null }),            ['temps_plein'])).toBe(false)
  })

  it('temps_plein + temps_partiel → les deux passent (ou entre eux)', () => {
    expect(matchHoraires(offre({ temps_travail: 'temps_plein' }),   ['temps_plein', 'temps_partiel'])).toBe(true)
    expect(matchHoraires(offre({ temps_travail: 'temps_partiel' }), ['temps_plein', 'temps_partiel'])).toBe(true)
  })

  it('travail de nuit seul → garde les offres avec nuit dans horaires', () => {
    expect(matchHoraires(offre({ horaires: ['nuit'] }),            ['nuit'])).toBe(true)
    expect(matchHoraires(offre({ horaires: ['journee'] }),         ['nuit'])).toBe(false)
    expect(matchHoraires(offre({ horaires: [] }),                  ['nuit'])).toBe(false)
  })

  it('journee + week_end → ou entre horaires : offre journée passe', () => {
    expect(matchHoraires(offre({ horaires: ['journee'] }),         ['journee', 'week_end'])).toBe(true)
    expect(matchHoraires(offre({ horaires: ['week_end'] }),        ['journee', 'week_end'])).toBe(true)
    expect(matchHoraires(offre({ horaires: ['equipes'] }),         ['journee', 'week_end'])).toBe(false)
  })

  it('temps_plein + travail de nuit → et entre sous-groupes', () => {
    // Offre temps plein + nuit → passe
    expect(matchHoraires(
      offre({ temps_travail: 'temps_plein', horaires: ['nuit'] }),
      ['temps_plein', 'nuit']
    )).toBe(true)

    // Offre temps plein + journée → ne passe pas (pas de nuit)
    expect(matchHoraires(
      offre({ temps_travail: 'temps_plein', horaires: ['journee'] }),
      ['temps_plein', 'nuit']
    )).toBe(false)

    // Offre temps partiel + nuit → ne passe pas (pas temps_plein)
    expect(matchHoraires(
      offre({ temps_travail: 'temps_partiel', horaires: ['nuit'] }),
      ['temps_plein', 'nuit']
    )).toBe(false)
  })

})

// ─── Règle 2 — Permis ─────────────────────────────────────────────────────────
// ou entre permis ; « sans_permis » = permis vide + publié après migration

describe('matchPermis', () => {

  it('aucun filtre → tout passe', () => {
    expect(matchPermis(offre({ permis: ['B'] }), [])).toBe(true)
    expect(matchPermis(offre(), [])).toBe(true)
  })

  it('permis B → garde les offres qui demandent le permis B', () => {
    expect(matchPermis(offre({ permis: ['B'] }),       ['B'])).toBe(true)
    expect(matchPermis(offre({ permis: ['C_CE'] }),    ['B'])).toBe(false)
    expect(matchPermis(offre({ permis: [] }),          ['B'])).toBe(false)
  })

  it('permis B + CACES → ou : une offre B passe, une offre CACES passe aussi', () => {
    expect(matchPermis(offre({ permis: ['B'] }),       ['B', 'CACES'])).toBe(true)
    expect(matchPermis(offre({ permis: ['CACES'] }),   ['B', 'CACES'])).toBe(true)
    expect(matchPermis(offre({ permis: ['D'] }),       ['B', 'CACES'])).toBe(false)
  })

  it('sans_permis → passe si permis vide ET publié après 2026-11-05T00:11:00Z', () => {
    expect(matchPermis(offre({ permis: [], published_at: APRES_MIGRATION }), ['sans_permis'])).toBe(true)
  })

  it('sans_permis → ne passe pas si publié avant la migration', () => {
    expect(matchPermis(offre({ permis: [], published_at: AVANT_MIGRATION }), ['sans_permis'])).toBe(false)
  })

  it('sans_permis → ne passe pas si permis non vide (même après migration)', () => {
    expect(matchPermis(offre({ permis: ['B'], published_at: APRES_MIGRATION }), ['sans_permis'])).toBe(false)
  })

  it('sans_permis → ne passe pas si published_at null', () => {
    expect(matchPermis(offre({ permis: [], published_at: null }), ['sans_permis'])).toBe(false)
  })

})

// ─── Règle 3 — Groupe « Autres » ─────────────────────────────────────────────
// et entre toutes les cases cochées

describe('matchAutres', () => {

  it('aucun filtre → tout passe', () => {
    expect(matchAutres(offre(), [])).toBe(true)
  })

  it('statut_cadre seul → garde les offres cadre uniquement', () => {
    expect(matchAutres(offre({ statut_cadre: true }),  ['statut_cadre'])).toBe(true)
    expect(matchAutres(offre({ statut_cadre: false }), ['statut_cadre'])).toBe(false)
  })

  it('logement_fourni + repas_fournis → et : les deux doivent être vrais', () => {
    expect(matchAutres(offre({ logement_fourni: true, repas_fournis: true }),  ['logement_fourni', 'repas_fournis'])).toBe(true)
    expect(matchAutres(offre({ logement_fourni: true, repas_fournis: false }), ['logement_fourni', 'repas_fournis'])).toBe(false)
    expect(matchAutres(offre({ logement_fourni: false, repas_fournis: true }), ['logement_fourni', 'repas_fournis'])).toBe(false)
  })

  it('ouvert_handicap → passe si vrai', () => {
    expect(matchAutres(offre({ ouvert_handicap: true }),  ['ouvert_handicap'])).toBe(true)
    expect(matchAutres(offre({ ouvert_handicap: false }), ['ouvert_handicap'])).toBe(false)
  })

  it('les quatre cases → et : toutes doivent être vraies', () => {
    const tout = ['statut_cadre', 'logement_fourni', 'repas_fournis', 'ouvert_handicap']
    expect(matchAutres(
      offre({ statut_cadre: true, logement_fourni: true, repas_fournis: true, ouvert_handicap: true }),
      tout
    )).toBe(true)
    expect(matchAutres(
      offre({ statut_cadre: true, logement_fourni: true, repas_fournis: true, ouvert_handicap: false }),
      tout
    )).toBe(false)
  })

})

// ─── Règle générale — entre groupes : et ─────────────────────────────────────
// (simulé via appel séquentiel comme dans applyFiltersOnly)

describe('règle générale : et entre les groupes', () => {

  it('temps_plein ET logement_fourni : seules les offres qui satisfont les deux passent', () => {
    const o1 = offre({ temps_travail: 'temps_plein', logement_fourni: true })
    const o2 = offre({ temps_travail: 'temps_plein', logement_fourni: false })
    const o3 = offre({ temps_travail: 'temps_partiel', logement_fourni: true })

    function passeTout(o: OffreChamps): boolean {
      return matchHoraires(o, ['temps_plein']) && matchAutres(o, ['logement_fourni'])
    }

    expect(passeTout(o1)).toBe(true)
    expect(passeTout(o2)).toBe(false)
    expect(passeTout(o3)).toBe(false)
  })

  it('permis B ET repas_fournis : seules les offres qui satisfont les deux passent', () => {
    const o1 = offre({ permis: ['B'], repas_fournis: true })
    const o2 = offre({ permis: ['B'], repas_fournis: false })
    const o3 = offre({ permis: ['C_CE'], repas_fournis: true })

    function passeTout(o: OffreChamps): boolean {
      return matchPermis(o, ['B']) && matchAutres(o, ['repas_fournis'])
    }

    expect(passeTout(o1)).toBe(true)
    expect(passeTout(o2)).toBe(false)
    expect(passeTout(o3)).toBe(false)
  })

})
